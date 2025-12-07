import streamlit as st
import pandas as pd
import yfinance as yf
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime, timedelta

# ページ設定
st.set_page_config(
    page_title="Stock Trade Visualizer", 
    layout="wide",
    page_icon="logo.png",
    initial_sidebar_state="collapsed"
)

# --- Custom CSS Injection ---
def local_css():
    st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

        /* 全体のフォントと背景 */
        html, body, [class*="css"] {
            font-family: 'Inter', sans-serif;
            color: #1f2937; /* Dark Gray Text */
            background-color: #ffffff;
        }
        
        /* メイン背景 */
        .stApp {
            background-color: #f9fafb; /* Very Light Gray */
        }

        /* サイドバー */
        section[data-testid="stSidebar"] {
            background-color: #ffffff;
            border-right: 1px solid #e5e7eb;
        }

        /* カード風コンテナ */
        .metric-card {
            background-color: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            text-align: center;
            transition: transform 0.2s;
        }
        .metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .metric-label {
            font-size: 0.875rem;
            color: #6b7280;
            margin-bottom: 0.5rem;
            font-weight: 600;
        }
        .metric-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #111827;
        }

        /* ボタン */
        .stButton > button {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); /* Blue Gradient */
            color: white;
            border: none;
            border-radius: 8px;
            padding: 0.5rem 1rem;
            font-weight: 600;
            transition: all 0.2s;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .stButton > button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);
        }

        /* ヘッダー */
        h1, h2, h3 {
            color: #1e3a8a; /* Dark Blue */
            font-weight: 700;
        }
        
        /* Plotlyチャートの背景調整 */
        .js-plotly-plot .plotly .main-svg {
            background: transparent !important;
        }
        
        /* Selectbox Styling */
        div[data-baseweb="select"] > div {
            background-color: #ffffff;
            border-color: #d1d5db;
            color: #1f2937;
        }
        /* Custom File Uploader Styling */
        [data-testid='stFileUploader'] {
            width: 100%;
        }
        
        /* Dropzone container - approximates the target */
        [data-testid='stFileUploader'] section {
            background-color: #f3f4f6;
            border: 2px dashed #d1d5db;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            transition: 0.3s;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: row; /* Align icon and text horizontally */
            gap: 10px;
        }
        
        [data-testid='stFileUploader'] section:hover {
            background-color: #e5e7eb;
            border-color: #2563eb;
        }

        /* Hide default elements inside the uploader */
        [data-testid='stFileUploader'] button,
        [data-testid='stFileUploader'] span, 
        [data-testid='stFileUploader'] small {
            display: none !important;
        }
        
        /* The Plus Icon */
        [data-testid='stFileUploader'] section::before {
            content: "＋";
            font-size: 2rem; /* Larger icon */
            font-weight: 900;
            color: #4b5563;
            margin-bottom: 5px; /* Slight adjustment for alignment */
        }

        /* The Text Label */
        [data-testid='stFileUploader'] section::after {
            content: "CSVファイルをアップロード";
            display: block;
            font-size: 1.2rem;
            font-weight: 700;
            color: #4b5563;
        }

        /* Crush the inner container so it doesn't take up space in Flexbox */
        [data-testid='stFileUploader'] section > div {
            flex: 0 0 0 !important;
            min-width: 0 !important;
            width: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: hidden !important;
        }
    </style>
    """, unsafe_allow_html=True)

def load_and_process_data(file):
    """
    アップロードされたCSVファイルを読み込み、前処理を行う関数
    """
    try:
        # 1. ヘッダー行の動的特定
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
        from io import StringIO
        csv_data = StringIO("\n".join(lines[header_row_index:]))
        df = pd.read_csv(csv_data)

        # 3. 不要データの除外
        df = df.dropna(subset=["銘柄コード"])

        # 4. 銘柄コードの整形
        def format_ticker(x):
            if pd.isna(x):
                return ""
            s = str(x).replace(".0", "")
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
        
        # 6. 日付の処理
        df["約定日"] = pd.to_datetime(df["約定日"])

        return df, None

    except Exception as e:
        return None, f"データ読み込み中にエラーが発生しました: {str(e)}"

def analyze_trade_performance(df):
    """
    データフレーム全体から売買ペアを特定し、損益レシオと勝率を計算する
    FIFO (先入れ先出し) 法でBuyとSellを突合
    """
    # 数量カラムの特定
    qty_col = None
    for col in ['約定数量', '数量', '株数']:
        if col in df.columns:
            qty_col = col
            break
            
    # 銘柄名カラムの特定
    name_col = None
    for col in ['銘柄名', '銘柄']:
        if col in df.columns:
            name_col = col
            break

    if not qty_col:
        return None, "数量データの列が見つかりません"

    trades = [] # 利益/損失のリスト
    trade_history = [] # 詳細履歴のリスト

    # 銘柄ごとに計算
    for ticker in df['銘柄コード'].unique():
        ticker_df = df[df['銘柄コード'] == ticker].sort_values('約定日')
        
        # 銘柄名の取得 (最初の行から)
        stock_name = ticker
        if name_col and not ticker_df.empty:
            stock_name = ticker_df.iloc[0][name_col]

        buy_queue = [] # [{'price': price, 'qty': qty, 'date': date}, ...]

        for _, row in ticker_df.iterrows():
            side = row['Side']
            price = row['約定単価']
            qty = row[qty_col]
            date = row['約定日']

            if side == 'Buy':
                buy_queue.append({'price': price, 'qty': qty, 'date': date})
            elif side == 'Sell':
                # 売り注文に対応する買い注文を古い順に消化
                while qty > 0 and buy_queue:
                    buy_pos = buy_queue[0]
                    
                    match_qty = min(buy_pos['qty'], qty)
                    
                    # 損益計算: (売値 - 買値) * 数量
                    pnl = (price - buy_pos['price']) * match_qty
                    trades.append(pnl)
                    
                    # 履歴記録
                    trade_history.append({
                        'ticker': ticker,
                        'name': stock_name,
                        'buy_date': buy_pos['date'],
                        'buy_price': buy_pos['price'],
                        'sell_date': date,
                        'sell_price': price,
                        'qty': match_qty,
                        'pnl': pnl
                    })

                    # 数量更新
                    buy_pos['qty'] -= match_qty
                    qty -= match_qty

                    # 買いポジションを使い切ったらキューから削除
                    if buy_pos['qty'] == 0:
                        buy_queue.pop(0)

    # 集計
    if not trades:
        return None, "完了したトレード（売り買いのセット）が見つかりませんでした。"

    winning_trades = [t for t in trades if t > 0]
    losing_trades = [t for t in trades if t <= 0]

    win_count = len(winning_trades)
    loss_count = len(losing_trades)
    total_completed = len(trades)

    win_rate = (win_count / total_completed) * 100 if total_completed > 0 else 0

    avg_profit = sum(winning_trades) / win_count if win_count > 0 else 0
    avg_loss = abs(sum(losing_trades) / loss_count) if loss_count > 0 else 0

    # 損益レシオ (平均損失が0の場合は便宜上0または無限大とするが、ここでは表示用に調整)
    risk_reward = avg_profit / avg_loss if avg_loss > 0 else float('inf')
    
    return {
        "win_rate": win_rate,
        "risk_reward": risk_reward,
        "total_trades": total_completed,
        "avg_profit": avg_profit,
        "avg_loss": avg_loss,
        "history": trade_history
    }, None

def main():
    local_css()
    
    # Navigation Link
    st.markdown("""
        <a href="http://localhost:3000/learning" target="_self" style="
            display: inline-flex;
            align-items: center;
            text-decoration: none;
            color: #6b7280;
            font-weight: 500;
            font-size: 0.9rem;
            margin-bottom: 20px;
            transition: color 0.2s;
        ">
            <span style="margin-right: 5px;">←</span> Back to Learning
        </a>
    """, unsafe_allow_html=True)
    
    # Header Section with Logo
    col1, col2 = st.columns([1, 10])
    with col1:
        st.image("logo.png", width=60)
    with col2:
        st.title("Stock Trade Visualizer")

    st.markdown("""
    <div style='margin-bottom: 1.5rem; color: #4b5563;'>
        証券会社の取引履歴CSVをアップロードして、自分のトレードを振り返りましょう！
    </div>
    """, unsafe_allow_html=True)

    # Data Upload Section
    uploaded_file = st.file_uploader("CSV upload", type=["csv"], label_visibility="collapsed")
    
    st.markdown("""
    <div style='font-size: 0.8rem; color: #6b7280; margin-bottom: 2rem;'>
        Supported: SBI証券. / Required: '約定日', '銘柄コード'
    </div>
    """, unsafe_allow_html=True)

    if uploaded_file is not None:
        with st.spinner("Processing data..."):
            df, error = load_and_process_data(uploaded_file)

        if error:
            st.error(error)
            return

        st.success("Data Loaded!")
        
        # 2. 銘柄選択
        ticker_options = sorted(df["銘柄コード"].unique())
        ticker_map = {}

        name_col = None
        if "銘柄名" in df.columns:
            name_col = "銘柄名"
        elif "銘柄" in df.columns:
            name_col = "銘柄"

        if name_col:
            ticker_map = df[["銘柄コード", name_col]].drop_duplicates().set_index("銘柄コード")[name_col].to_dict()
        
        # マップにない銘柄はyfinanceから取得
        @st.cache_data
        def fetch_ticker_names(tickers):
            names = {}
            for t in tickers:
                try:
                    ticker_info = yf.Ticker(t)
                    info = ticker_info.info
                    names[t] = info.get('shortName') or info.get('longName') or t
                except:
                    names[t] = t
            return names

        missing_tickers = [t for t in ticker_options if t not in ticker_map]
        if missing_tickers:
            with st.spinner("Fetching ticker names..."):
                fetched_names = fetch_ticker_names(missing_tickers)
                ticker_map.update(fetched_names)

        def format_func(ticker):
            name = ticker_map.get(ticker, ticker)
            return f"{ticker} {name}"

        # メインエリアで銘柄選択
        selected_ticker = st.selectbox("Select Ticker", ticker_options, format_func=format_func)

        # データをキャッシュする関数
        @st.cache_data(ttl=3600)
        def fetch_stock_data(ticker, start, end):
            ticker_obj = yf.Ticker(ticker)
            return ticker_obj.history(start=start, end=end)

        if selected_ticker:
            ticker_df = df[df["銘柄コード"] == selected_ticker].copy()
            

            # 3. チャート描画
            try:
                min_trade_date = ticker_df["約定日"].min()
                max_trade_date = ticker_df["約定日"].max()
                
                display_start_date = min_trade_date - timedelta(days=30)
                end_date = max_trade_date + timedelta(days=30)
                fetch_start_date = display_start_date - timedelta(days=40)

                if end_date > datetime.today():
                    end_date = datetime.today()

                with st.spinner(f"Loading chart for {selected_ticker}..."):
                    stock_data = fetch_stock_data(selected_ticker, fetch_start_date, end_date)
                
                if stock_data.empty:
                    st.error(f"No stock data found for {selected_ticker}.")
                else:
                    stock_data['SMA5'] = stock_data['Close'].rolling(window=5).mean()
                    stock_data['SMA25'] = stock_data['Close'].rolling(window=25).mean()
                    stock_data = stock_data[stock_data.index >= pd.Timestamp(display_start_date).tz_localize(stock_data.index.tz)]

                    # Plotly Chart
                    fig = make_subplots(
                        rows=2, cols=1, 
                        shared_xaxes=True, 
                        vertical_spacing=0.05, 
                        row_heights=[0.75, 0.25],
                        subplot_titles=("Price Action", "Volume")
                    )

                    stock_data['DateStr'] = stock_data.index.strftime('%Y-%m-%d')
                    
                    # Candlestick (Modern Colors)
                    fig.add_trace(go.Candlestick(
                        x=stock_data['DateStr'],
                        open=stock_data['Open'],
                        high=stock_data['High'],
                        low=stock_data['Low'],
                        close=stock_data['Close'],
                        name='Price',
                        increasing_line_color='#10b981', # Emerald Green
                        decreasing_line_color='#ef4444'  # Red
                    ), row=1, col=1)
                    
                    # SMAs
                    fig.add_trace(go.Scatter(
                        x=stock_data['DateStr'],
                        y=stock_data['SMA5'],
                        mode='lines',
                        name='SMA 5',
                        line=dict(color='#f59e0b', width=1.5) # Amber
                    ), row=1, col=1)
                    
                    fig.add_trace(go.Scatter(
                        x=stock_data['DateStr'],
                        y=stock_data['SMA25'],
                        mode='lines',
                        name='SMA 25',
                        line=dict(color='#2563eb', width=1.5) # Blue
                    ), row=1, col=1)

                    
                    # Trade Markers & Annotations
                    qty_col = None
                    for col in ['約定数量', '数量', '株数']:
                        if col in ticker_df.columns:
                            qty_col = col
                            break
                    

                    # Iterate over all trades to add annotations
                    for index, row in ticker_df.iterrows():
                        if row["Side"] not in ["Buy", "Sell"]:
                            continue
                        
                        date_str = row["約定日"].strftime('%Y-%m-%d')
                        if date_str not in stock_data['DateStr'].values:
                            continue # Skip if date is not in chart range (though range is extended now)

                        price = row["約定単価"]
                        qty = row[qty_col] if qty_col else '-'
                        side_label = "買" if row["Side"] == "Buy" else "売"
                        color = '#ef4444' if row["Side"] == "Buy" else '#2563eb'

                        # Annotation (Speech Bubble)
                        # Format: 12/5 買 1055円 100株
                        short_date = row["約定日"].strftime('%m/%d')
                        annotation_text = f"<b>{short_date} {side_label}<br>{int(price)}円 {qty}株</b>"

                        # Increase distance for visibility
                        ay_distance = -60 if row["Side"] == "Buy" else 60

                        fig.add_annotation(
                            x=date_str,
                            y=price,
                            text=annotation_text,
                            showarrow=True,
                            arrowhead=2,
                            arrowsize=1,
                            arrowwidth=2,
                            arrowcolor=color,
                            ax=0,
                            ay=ay_distance,
                            bgcolor="white",
                            bordercolor=color,
                            borderwidth=2,
                            borderpad=4,
                            font=dict(color=color, size=12),
                            opacity=1.0
                        )

                    # Volume
                    fig.add_trace(go.Bar(
                        x=stock_data['DateStr'],
                        y=stock_data['Volume'],
                        name='Volume',
                        marker_color='#9ca3af', # Gray
                        opacity=0.4
                    ), row=2, col=1)

                    # Layout Styling
                    all_dates = stock_data['DateStr'].tolist()
                    formatted_dates = [d[5:].replace('-', '/') for d in all_dates]
                    
                    fig.update_layout(
                        height=800,
                        template="plotly_white", # Light Theme
                        paper_bgcolor='rgba(0,0,0,0)',
                        plot_bgcolor='rgba(0,0,0,0)',
                        font=dict(family="Inter, sans-serif", color="#1f2937"),
                        xaxis2=dict(
                            type='category',
                            tickmode='array',
                            tickvals=all_dates,
                            ticktext=formatted_dates,
                            title=None,
                            gridcolor='#e5e7eb'
                        ),
                        xaxis=dict(
                            type='category',
                            showticklabels=False,
                            gridcolor='#e5e7eb'
                        ),
                        yaxis=dict(title="Price (JPY)", gridcolor='#e5e7eb'),
                        yaxis2=dict(title="Volume", gridcolor='#e5e7eb'),
                        showlegend=True,
                        legend=dict(
                            orientation="h",
                            yanchor="bottom",
                            y=1.02,
                            xanchor="right",
                            x=1
                        ),
                        margin=dict(l=20, r=20, t=60, b=20)
                    )
                    
                    fig.update_xaxes(tickangle=-45, nticks=20, row=2, col=1)
                    fig.update_layout(xaxis_rangeslider_visible=False)

                    st.plotly_chart(fig, use_container_width=True)

            except Exception as e:
                st.error(f"Error plotting chart: {str(e)}")

        # --- Whole Portfolio Analysis (Display at the bottom) ---
        st.markdown("---")
        st.subheader("📊 全体トレード分析 (ポートフォリオ全体)")
        
        analysis_result, analysis_error = analyze_trade_performance(df)
        
        if analysis_error:
            st.warning(analysis_error)
        elif analysis_result:
            # Metrics
            win_rate = analysis_result["win_rate"]
            risk_reward = analysis_result["risk_reward"]
            
            # Formatting
            rr_display = f"{risk_reward:.2f}" if risk_reward != float('inf') else "∞"
            
            # Layout
            col1, col2 = st.columns(2)
            
            # Win Rate Card
            with col1:
                st.markdown(f"""
                <div style="background-color: #ffffff; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="color: #6b7280; font-size: 0.9rem; font-weight: 600; margin-bottom: 5px;">勝率 (Win Rate)</div>
                    <div style="font-size: 2rem; font-weight: 700; color: #111827;">{win_rate:.1f}%</div>
                    <div style="margin-top: 10px; font-size: 0.8rem; color: #4b5563; line-height: 1.4;">
                        <strong>意味:</strong> 利益が出たトレードの割合です。<br>
                        <strong>目安:</strong> 40%〜60% (損益レシオとのバランスが重要)
                    </div>
                </div>
                """, unsafe_allow_html=True)

            # Risk Reward Card
            with col2:
                st.markdown(f"""
                <div style="background-color: #ffffff; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="color: #6b7280; font-size: 0.9rem; font-weight: 600; margin-bottom: 5px;">損益レシオ (Risk Reward)</div>
                    <div style="font-size: 2rem; font-weight: 700; color: #111827;">{rr_display}</div>
                    <div style="margin-top: 10px; font-size: 0.8rem; color: #4b5563; line-height: 1.4;">
                        <strong>意味:</strong> 平均利益 ÷ 平均損失。<br>
                        <strong>目安:</strong> 1.0以上 (1.5以上だと優秀)
                    </div>
                </div>
                """, unsafe_allow_html=True)
            
            st.caption(f"※ 計算対象: 完了したトレードセット (合計 {analysis_result['total_trades']} 回)")
            
            # Detailed Trade History
            with st.expander("✅ 分析対象のトレード詳細 (完了したセット)"):
                history = analysis_result.get("history", [])
                if history:
                    for h in history:
                        b_date = h['buy_date'].strftime('%Y/%m/%d')
                        s_date = h['sell_date'].strftime('%Y/%m/%d')
                        name = h.get('name', h['ticker'])
                        pnl = int(h['pnl'])
                        pnl_str = f"+{pnl}" if pnl > 0 else f"{pnl}"
                        
                        st.markdown(f"""
                        <div style='font-family: monospace; font-size: 0.9rem; border-bottom: 1px solid #f3f4f6; padding: 4px 0;'>
                            <strong style='color: #1f2937; margin-right: 8px;'>{name}</strong> 
                            {b_date} 買 {int(h['buy_price'])}円 ({int(h['qty'])}株) 
                            <span style='color: #9ca3af;'>→</span> 
                            {s_date} 売 {int(h['sell_price'])}円 ({int(h['qty'])}株)
                            <span style='float: right; font-weight: bold; color: {'#10b981' if pnl > 0 else '#ef4444'};'>
                                {pnl_str}円
                            </span>
                        </div>
                        """, unsafe_allow_html=True)
                else:
                    st.write("詳細データはありません。")

if __name__ == "__main__":
    main()
