import yfinance as yf
from datetime import datetime

try:
    ticker = "7203.T"
    start = "2024-01-01"
    end = datetime.today().strftime('%Y-%m-%d')
    
    print(f"Downloading {ticker} from {start} to {end}...")
    data = yf.download(ticker, start=start, end=end, progress=False)
    
    print("Data shape:", data.shape)
    print("Columns:", data.columns)
    if not data.empty:
        print("Head:", data.head())
    else:
        print("Data is empty.")

except Exception as e:
    print(f"Error: {e}")
