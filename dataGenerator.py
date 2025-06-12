

import yfinance as yf
import pandas as pd

tickerNames = {
    "IAGG": "Bloomberg Global Aggregate",
    "AGG": "Bloomberg US Aggregate",
    "VTC": "Bloomberg Corporate Bond",
    "MUB": "Bloomberg Municipal Bond",
    "BIL": "Bloomberg US Treasury Bills 1-3 Month",
    "VNQ": "CRSP US REIT Index Total Return",
    "IWB": "Russell 1000",
    "IWM": "Russell 2000",
    "IWV": "Russell 3000",
    "ACWI": "MSCI ACWI Total Return",
    "EFA": "MSCI ACWI Ex USA Large Cap",
    "VSS": "Ex-US SMID Index",
    "ACWX": "MSCI ACWI Ex USA Total Return",
    "GLD": "S&P GSCI Gold Total Return",
    "IVV": "S&P 500 Total Return",
    "BIZD": "Private Equity (BIZD)",
    "VPC": "Private Debt (VPC)",
    "GBTC": "Bitcoin"
}
tickerTo_fetch = list(tickerNames.keys())
period = "10y"
allData = [] 

print("Starting Data Fetch")

try:
    
    for ticker in tickerTo_fetch:
        print(f"Fetching data for {ticker}...")
        
        
        t = yf.Ticker(ticker)
        
        hist = t.history(period=period, auto_adjust=False, back_adjust=False)
        
        if hist.empty:
            print(f"  -> Warning: Could not fetch historical data for {ticker}. It will be excluded.")
            continue 
        
        
        if 'Dividends' not in hist.columns:
            hist['Dividends'] = 0
            
        
        tickerDf = hist[['Adj Close', 'Dividends']].copy()
        
        
        tickerDf['Ticker'] = ticker
        tickerDf['Name'] = tickerNames[ticker]
        
        
        allData.append(tickerDf)

    
    if not allData:
        raise Exception("No data could be fetched for any of the specified tickers.")

    finalDf = pd.concat(allData)
    finalDf.reset_index(inplace=True)
    finalDf.rename(columns={'Adj Close': 'Price', 'Dividends': 'Dividend'}, inplace=True)
    finalDf['Dividend'] = finalDf['Dividend'].fillna(0)
    
    
    finalDf = finalDf[['Date', 'Ticker', 'Name', 'Price', 'Dividend']]

    
    outputFile_name = 'stockData.csv'
    finalDf.to_csv(outputFile_name, index=False)


    print(f"Data has been successfully saved to '{outputFile_name}'")
    print(f"Total rows created: {len(finalDf)}")

except Exception as e:
    print(f"\n--- An Error Occurred ---")
    print(f"Error: {e}")
    print("Please check your ticker symbols and internet connection.")