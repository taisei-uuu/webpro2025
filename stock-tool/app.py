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
    initial_sidebar_state="expanded"
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

def main():
    local_css()
    
    # サイドバーにロゴを表示
    with st.sidebar:
        try:
            st.image("logo.png", width=50)
        except:
            pass # ロゴがない場合はスキップ
        st.title("Stock Visualizer")
        
        st.markdown("---")
        st.header("Data Upload")
        uploaded_file = st.file_uploader("↑ CSV Data Upload", type=["csv"])
        
        st.markdown("""
        <div style='font-size: 0.8rem; color: #6b7280; margin-top: 1rem;'>
            Supported: SBI証券, 楽天証券, etc.<br>
            Required: '約定日', '銘柄コード'
        </div>
        """, unsafe_allow_html=True)

    st.title("📈 Stock Trade Visualizer")
    st.markdown("""
    <div style='margin-bottom: 2rem; color: #4b5563;'>
        証券会社の取引履歴CSVをアップロードして、あなたのトレードを美しく可視化します。
    </div>
    """, unsafe_allow_html=True)

    if uploaded_file is not None:
        with st.spinner("Processing data..."):
            df, error = load_and_process_data(uploaded_file)

        if error:
            st.error(error)
            return

        st.sidebar.success("Data Loaded!")
        
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

        # サイドバーで銘柄選択
        selected_ticker = st.sidebar.selectbox("Select Ticker", ticker_options, format_func=format_func)

        # データをキャッシュする関数
        @st.cache_data(ttl=3600)
        def fetch_stock_data(ticker, start, end):
            ticker_obj = yf.Ticker(ticker)
            return ticker_obj.history(start=start, end=end)

        if selected_ticker:
            ticker_df = df[df["銘柄コード"] == selected_ticker].copy()
            
            # --- Dashboard Metrics ---
            total_trades = len(ticker_df)
            buy_count = len(ticker_df[ticker_df["Side"] == "Buy"])
            sell_count = len(ticker_df[ticker_df["Side"] == "Sell"])
            last_trade = ticker_df["約定日"].max().strftime('%Y-%m-%d')

            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.markdown(f"""<div class="metric-card"><div class="metric-label">Total Trades</div><div class="metric-value">{total_trades}</div></div>""", unsafe_allow_html=True)
            with col2:
                st.markdown(f"""<div class="metric-card"><div class="metric-label">Buy Orders</div><div class="metric-value" style="color: #ef4444;">{buy_count}</div></div>""", unsafe_allow_html=True)
            with col3:
                st.markdown(f"""<div class="metric-card"><div class="metric-label">Sell Orders</div><div class="metric-value" style="color: #2563eb;">{sell_count}</div></div>""", unsafe_allow_html=True)
            with col4:
                st.markdown(f"""<div class="metric-card"><div class="metric-label">Last Trade</div><div class="metric-value" style="font-size: 1.2rem;">{last_trade}</div></div>""", unsafe_allow_html=True)

            st.markdown("<br>", unsafe_allow_html=True)

            # 3. チャート描画
            try:
                min_trade_date = ticker_df["約定日"].min()
                max_trade_date = ticker_df["約定日"].max()
                
                display_start_date = min_trade_date - timedelta(days=15)
                end_date = max_trade_date + timedelta(days=15)
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

                    # Trade Markers
                    qty_col = None
                    for col in ['約定数量', '数量', '株数']:
                        if col in ticker_df.columns:
                            qty_col = col
                            break
                    
                    # Buy Markers
                    buy_df = ticker_df[ticker_df["Side"] == "Buy"].copy()
                    if not buy_df.empty:
                        buy_df['DateStr'] = buy_df["約定日"].dt.strftime('%Y-%m-%d')
                        fig.add_trace(go.Scatter(
                            x=buy_df['DateStr'],
                            y=buy_df["約定単価"],
                            mode='markers',
                            marker=dict(symbol='triangle-up', size=14, color='#ef4444', line=dict(width=1, color='white')),
                            name='Buy',
                            text=buy_df.apply(lambda row: f"BUY<br>{row['約定日'].date()}<br>{row['約定単価']}円<br>{row[qty_col] if qty_col else '-'}株", axis=1),
                            hoverinfo='text'
                        ), row=1, col=1)

                    # Sell Markers
                    sell_df = ticker_df[ticker_df["Side"] == "Sell"].copy()
                    if not sell_df.empty:
                        sell_df['DateStr'] = sell_df["約定日"].dt.strftime('%Y-%m-%d')
                        fig.add_trace(go.Scatter(
                            x=sell_df['DateStr'],
                            y=sell_df["約定単価"],
                            mode='markers',
                            marker=dict(symbol='triangle-down', size=14, color='#2563eb', line=dict(width=1, color='white')),
                            name='Sell',
                            text=sell_df.apply(lambda row: f"SELL<br>{row['約定日'].date()}<br>{row['約定単価']}円<br>{row[qty_col] if qty_col else '-'}株", axis=1),
                            hoverinfo='text'
                        ), row=1, col=1)

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

if __name__ == "__main__":
    main()
