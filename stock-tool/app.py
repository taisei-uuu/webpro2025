import streamlit as st
import pandas as pd
import yfinance as yf
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime, timedelta

# ページ設定
st.set_page_config(page_title="Stock Trade Visualizer", layout="wide")

def load_and_process_data(file):
    """
    アップロードされたCSVファイルを読み込み、前処理を行う関数
    """
    try:
        # 1. ヘッダー行の動的特定
        # ファイルを一度読み込んで、ヘッダー行を探す
        content = file.getvalue().decode("shift-jis", errors="ignore") # 日本語CSVを想定
        lines = content.splitlines()
        
        header_row_index = None
        for i, line in enumerate(lines):
            if "約定日" in line and "銘柄コード" in line:
                header_row_index = i
                break
        
        if header_row_index is None:
            return None, "CSV内に「約定日」または「銘柄コード」が見つかりませんでした。"

        # 2. CSV読み込み
        # fileポインタを先頭に戻す必要があるが、pd.read_csvに直接渡すために再度アップロードされたファイルを使うか、
        # StringIOを使う。ここではlinesからDataFrameを作成する方が確実。
        from io import StringIO
        csv_data = StringIO("\n".join(lines[header_row_index:]))
        df = pd.read_csv(csv_data)

        # 3. 不要データの除外
        # 銘柄コードが空欄の行を除外
        df = df.dropna(subset=["銘柄コード"])

        # 4. 銘柄コードの整形
        def format_ticker(x):
            if pd.isna(x):
                return ""
            s = str(x).replace(".0", "") # 整数がfloatで読まれた場合などの対策
            if not s.endswith(".T"):
                return s + ".T"
            return s

        df["銘柄コード"] = df["銘柄コード"].apply(format_ticker)

        # 5. 売買区分の判定
        def get_side(x):
            if not isinstance(x, str):
                return None
            if "買" in x:
                return "Buy"
            elif "売" in x:
                return "Sell"
            return None

        df["Side"] = df["取引"].apply(get_side)
        
        # Sideが判定できない行（入出金など）は除外するか、プロット時に無視する。
        # ここではプロット時にSideでフィルタリングするため、そのままで良いが、
        # 明示的にBuy/Sellのみ残す要件はないため、Sideカラムを作るにとどめる。

        # 6. 日付の処理
        df["約定日"] = pd.to_datetime(df["約定日"])

        return df, None

    except Exception as e:
        return None, f"データ読み込み中にエラーが発生しました: {str(e)}"

def main():
    st.title("📈 株式取引履歴 可視化アプリ")
    st.markdown("証券会社の取引履歴CSVをアップロードして、チャート上に売買ポイントをプロットします。")

    # 1. サイドバー: CSVアップロード
    st.sidebar.header("データアップロード")
    uploaded_file = st.sidebar.file_uploader("取引履歴CSVをアップロード", type=["csv"])

    if uploaded_file is not None:
        with st.spinner("データを読み込んでいます..."):
            df, error = load_and_process_data(uploaded_file)

        if error:
            st.error(error)
            return

        st.sidebar.success("読み込み完了！")
        
        # データプレビュー（デバッグ用・ユーザー確認用）
        with st.expander("読み込んだデータを確認"):
            st.dataframe(df)

        # 2. 銘柄選択
        # ユニークな銘柄リストを作成
        ticker_options = sorted(df["銘柄コード"].unique())
        ticker_map = {}

        # CSVに銘柄名があるか確認
        name_col = None
        if "銘柄名" in df.columns:
            name_col = "銘柄名"
        elif "銘柄" in df.columns:
            name_col = "銘柄"

        if name_col:
            # CSVから取得
            ticker_map = df[["銘柄コード", name_col]].drop_duplicates().set_index("銘柄コード")[name_col].to_dict()
        
        # マップにない銘柄（またはCSVに名前がない場合）はyfinanceから取得
        # st.cache_dataを使ってAPIコールを削減
        @st.cache_data
        def fetch_ticker_names(tickers):
            names = {}
            for t in tickers:
                try:
                    ticker_info = yf.Ticker(t)
                    # infoは重い場合があるので、まずはhistoryのmetaなどを確認したいが、
                    # 確実なのはinfo。ただし遅い可能性あり。
                    # 多くの銘柄がある場合は時間がかかるため、プログレスバーなどが望ましいが、
                    # ここではシンプルに実装。
                    info = ticker_info.info
                    names[t] = info.get('shortName') or info.get('longName') or t
                except:
                    names[t] = t
            return names

        # 名前が取得できていない銘柄のみAPIで取得
        missing_tickers = [t for t in ticker_options if t not in ticker_map]
        if missing_tickers:
            with st.spinner("銘柄情報を取得中..."):
                fetched_names = fetch_ticker_names(missing_tickers)
                ticker_map.update(fetched_names)

        def format_func(ticker):
            name = ticker_map.get(ticker, ticker)
            return f"{ticker} {name}"

        selected_ticker = st.selectbox("銘柄を選択してください", ticker_options, format_func=format_func)

        # データをキャッシュする関数を定義
        @st.cache_data(ttl=3600) # 1時間キャッシュ
        def fetch_stock_data(ticker, start, end):
            ticker_obj = yf.Ticker(ticker)
            return ticker_obj.history(start=start, end=end)

        if selected_ticker:
            # 選択された銘柄のデータを抽出
            ticker_df = df[df["銘柄コード"] == selected_ticker].copy()
            
            # 3. チャート描画
            try:
                # 期間設定: 取引データの最初と最後から前後半月分
                min_trade_date = ticker_df["約定日"].min()
                max_trade_date = ticker_df["約定日"].max()
                
                display_start_date = min_trade_date - timedelta(days=15)
                end_date = max_trade_date + timedelta(days=15)
                
                # 移動平均線計算のために、表示開始日より少し前からデータを取得する（25日線のために約40日前から）
                fetch_start_date = display_start_date - timedelta(days=40)

                # 未来の日付は今日までにする
                if end_date > datetime.today():
                    end_date = datetime.today()

                with st.spinner(f"{selected_ticker} の株価データを取得中..."):
                    # キャッシュされた関数を使用
                    stock_data = fetch_stock_data(selected_ticker, fetch_start_date, end_date)
                
                if stock_data.empty:
                    st.error(f"{selected_ticker} の株価データが見つかりませんでした。")
                else:
                    # 移動平均線の計算
                    stock_data['SMA5'] = stock_data['Close'].rolling(window=5).mean()
                    stock_data['SMA25'] = stock_data['Close'].rolling(window=25).mean()
                    
                    # 表示期間のみにフィルタリング
                    # indexはtimezone awareな場合があるので、tz_localize(None)して比較するか、文字列で比較
                    # ここでは単純に日付比較を行うために、indexをdatetime型として扱う
                    stock_data = stock_data[stock_data.index >= pd.Timestamp(display_start_date).tz_localize(stock_data.index.tz)]



                    # Plotlyでチャート作成（サブプロット: 上段=株価, 下段=出来高）
                    fig = make_subplots(
                        rows=2, cols=1, 
                        shared_xaxes=True, 
                        vertical_spacing=0.05, 
                        row_heights=[0.7, 0.3],
                        subplot_titles=(f"{selected_ticker} 取引ポイント", "出来高")
                    )

                    # 休日除外のため、日付を文字列（カテゴリー）として扱う
                    stock_data['DateStr'] = stock_data.index.strftime('%Y-%m-%d')
                    
                    # ローソク足 (Row 1)
                    fig.add_trace(go.Candlestick(
                        x=stock_data['DateStr'],
                        open=stock_data['Open'],
                        high=stock_data['High'],
                        low=stock_data['Low'],
                        close=stock_data['Close'],
                        name='株価'
                    ), row=1, col=1)
                    
                    # 移動平均線 (Row 1)
                    fig.add_trace(go.Scatter(
                        x=stock_data['DateStr'],
                        y=stock_data['SMA5'],
                        mode='lines',
                        name='5日移動平均',
                        line=dict(color='orange', width=1)
                    ), row=1, col=1)
                    
                    fig.add_trace(go.Scatter(
                        x=stock_data['DateStr'],
                        y=stock_data['SMA25'],
                        mode='lines',
                        name='25日移動平均',
                        line=dict(color='green', width=1)
                    ), row=1, col=1)

                    # 売買ポイントのプロット (Row 1)
                    # 数量カラムの特定
                    qty_col = None
                    for col in ['約定数量', '数量', '株数']:
                        if col in ticker_df.columns:
                            qty_col = col
                            break
                    
                    # Buy
                    buy_df = ticker_df[ticker_df["Side"] == "Buy"].copy()
                    if not buy_df.empty:
                        buy_df['DateStr'] = buy_df["約定日"].dt.strftime('%Y-%m-%d')
                        fig.add_trace(go.Scatter(
                            x=buy_df['DateStr'],
                            y=buy_df["約定単価"], # 約定単価の位置にプロット
                            mode='markers',
                            marker=dict(symbol='triangle-up', size=12, color='red'),
                            name='買',
                            text=buy_df.apply(lambda row: f"{row['約定日'].date()}<br>{row['取引']}<br>{row['約定単価']}円<br>{row[qty_col] if qty_col else '-'}株", axis=1),
                            hoverinfo='text'
                        ), row=1, col=1)

                    # Sell
                    sell_df = ticker_df[ticker_df["Side"] == "Sell"].copy()
                    if not sell_df.empty:
                        sell_df['DateStr'] = sell_df["約定日"].dt.strftime('%Y-%m-%d')
                        fig.add_trace(go.Scatter(
                            x=sell_df['DateStr'],
                            y=sell_df["約定単価"],
                            mode='markers',
                            marker=dict(symbol='triangle-down', size=12, color='blue'),
                            name='売',
                            text=sell_df.apply(lambda row: f"{row['約定日'].date()}<br>{row['取引']}<br>{row['約定単価']}円<br>{row[qty_col] if qty_col else '-'}株", axis=1),
                            hoverinfo='text'
                        ), row=1, col=1)

                    # 出来高 (Row 2)
                    fig.add_trace(go.Bar(
                        x=stock_data['DateStr'],
                        y=stock_data['Volume'],
                        name='出来高',
                        marker_color='gray',
                        opacity=0.5
                    ), row=2, col=1)

                    # X軸のラベル作成（MM/DD形式）
                    all_dates = stock_data['DateStr'].tolist()
                    formatted_dates = [d[5:].replace('-', '/') for d in all_dates] # YYYY-MM-DD -> MM/DD
                    
                    fig.update_layout(
                        height=800, # 高さを増やす
                        template="plotly_dark",
                        xaxis2=dict( # 下段のX軸設定
                            type='category',
                            tickmode='array',
                            tickvals=all_dates,
                            ticktext=formatted_dates,
                            title="日付"
                        ),
                        xaxis=dict( # 上段のX軸設定（ラベル非表示）
                            type='category',
                            showticklabels=False
                        ),
                        yaxis=dict(title="価格"),
                        yaxis2=dict(title="出来高"),
                        showlegend=True
                    )
                    
                    # X軸のラベルが見やすくなるように調整
                    fig.update_xaxes(tickangle=-45, nticks=20, row=2, col=1)
                    
                    # レンジスライダーを無効化（サブプロットだと崩れやすいため）
                    fig.update_layout(xaxis_rangeslider_visible=False)

                    st.plotly_chart(fig, use_container_width=True)

            except Exception as e:
                st.error(f"チャート描画中にエラーが発生しました: {str(e)}")

if __name__ == "__main__":
    main()
