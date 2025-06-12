

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const tickerSelect = document.getElementById('ticker-select');
    const addTickerBtn = document.getElementById('add-ticker-btn');
    const portfolioInputs = document.getElementById('portfolio-inputs');
    const totalAllocationEl = document.getElementById('total-allocation');
    const timeframeButtons = document.querySelector('.timeframe-buttons');
    const chartDiv = document.getElementById('chart');
    const returnResultEl = document.getElementById('return-result');
    const stdDevResultEl = document.getElementById('std-dev-result');
    const yieldResultEl = document.getElementById('yield-result');
    const pieChartDiv = document.getElementById('pie-chart'); // 

    
    let stockData = {};
    let availableTickers = [];
    let activeTimeframe = 5;

    
    async function init() {
        try {
            const rawData = await loadCSVData('stockData.csv');
            stockData = groupDataByTicker(rawData);
            availableTickers = Object.keys(stockData).sort((a, b) => stockData[a][0].name.localeCompare(stockData[b][0].name));
            populateTickerSelect();
            setupEventListeners();
            addPortfolioRow('IVV');
        } catch (error) {
            console.error("Initialization failed:", error);
            chartDiv.innerHTML = `<p style="color: red; text-align: center;">Error: Could not load stock_data.csv. Make sure the file is in the same folder as index.html and was generated correctly.</p>`;
        }
    }

    
    async function loadCSVData(filePath) {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csvText = await response.text();
        const lines = csvText.split('\n').slice(1);
        return lines.map(line => {
            const parts = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
            const [date, ticker, name, price, dividend] = parts.map(p => p.replace(/"/g, ''));
            return { date: new Date(date), ticker, name, price: parseFloat(price), dividend: parseFloat(dividend) };
        }).filter(row => row.ticker && !isNaN(row.date));
    }

    function groupDataByTicker(data) {
        return data.reduce((acc, row) => {
            if (!acc[row.ticker]) acc[row.ticker] = [];
            acc[row.ticker].push(row);
            return acc;
        }, {});
    }

    
    function populateTickerSelect() {
        availableTickers.forEach(ticker => {
            const option = document.createElement('option');
            option.value = ticker;
            option.textContent = stockData[ticker][0].name;
            tickerSelect.appendChild(option);
        });
    }

    function setupEventListeners() {
        addTickerBtn.addEventListener('click', () => addPortfolioRow(tickerSelect.value));
        timeframeButtons.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                activeTimeframe = parseInt(e.target.dataset.years, 10);
                timeframeButtons.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                runAnalysis();
            }
        });
    }

    function addPortfolioRow(ticker) {
        if (document.querySelector(`[data-ticker="${ticker}"]`)) {
            alert(`${stockData[ticker][0].name} is already in the portfolio.`);
            return;
        }
        const row = document.createElement('div');
        row.className = 'portfolio-row';
        row.dataset.ticker = ticker;
        row.innerHTML = `
            <div class="asset-name">
                <span>${stockData[ticker][0].name}</span>
                <small>${ticker}</small>
            </div>
            <input type="number" class="allocation-input" value="10" min="0" max="100" placeholder="%">
            <button class="remove-btn">Remove</button>
        `;
        portfolioInputs.appendChild(row);
        row.querySelector('.allocation-input').addEventListener('input', runAnalysis);
        row.querySelector('.remove-btn').addEventListener('click', () => {
            row.remove();
            runAnalysis();
        });
        runAnalysis();
    }

    
    function runAnalysis() {
        const portfolio = getUserPortfolio();
        updateTotalAllocation(portfolio.totalWeight);
        drawPieChart(portfolio); 

        if (portfolio.totalWeight !== 100 || portfolio.tickers.length === 0) {
            Plotly.purge(chartDiv);
            chartDiv.innerHTML = `<p style="text-align: center; padding: 50px;">Please ensure total allocation is 100% to see the analysis.</p>`;
            returnResultEl.textContent = '-';
            stdDevResultEl.textContent = '-';
            yieldResultEl.textContent = '-';
            return;
        }

        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - activeTimeframe);

        const dateLookup = new Map();
        portfolio.tickers.forEach(item => {
            if (stockData[item.ticker]) {
                stockData[item.ticker]
                    .filter(d => d.date >= startDate && d.date <= endDate)
                    .forEach(d => {
                        const dateStr = d.date.toISOString().split('T')[0];
                        if (!dateLookup.has(dateStr)) dateLookup.set(dateStr, {});
                        dateLookup.get(dateStr)[item.ticker] = { price: d.price, dividend: d.dividend };
                    });
            }
        });
        const sortedDates = Array.from(dateLookup.keys()).sort();
        
        if (sortedDates.length < 2) {
            chartDiv.innerHTML = `<p style="text-align: center; padding: 50px;">Not enough historical data for the selected tickers in this timeframe.</p>`;
            return;
        }

        const portfolioValues = [];
        const dailyReturns = [];
        const initialPortfolioValue = 10000;
        
        const tickerState = {};
        const firstDayData = dateLookup.get(sortedDates[0]);
        for (const item of portfolio.tickers) {
            if (firstDayData[item.ticker]) {
                tickerState[item.ticker] = {
                    shares: (initialPortfolioValue * (item.weight / 100)) / firstDayData[item.ticker].price,
                    totalDividends: 0, priceSum: 0, priceCount: 0
                };
            }
        }
        
        for (const dateStr of sortedDates) {
            let dailyPortfolioValue = 0;
            let isDataCompleteForDay = true;
            const tickersDataForDay = dateLookup.get(dateStr);

            for (const item of portfolio.tickers) {
                const state = tickerState[item.ticker];
                const dayData = tickersDataForDay[item.ticker];
                if (!state || !dayData) { isDataCompleteForDay = false; break; }
                dailyPortfolioValue += state.shares * dayData.price;
                state.totalDividends += state.shares * dayData.dividend;
                state.priceSum += dayData.price;
                state.priceCount++;
            }

            if (isDataCompleteForDay) {
                const prevValue = portfolioValues.length > 0 ? portfolioValues[portfolioValues.length - 1].value : dailyPortfolioValue;
                portfolioValues.push({ date: new Date(dateStr), value: dailyPortfolioValue });
                if (portfolioValues.length > 1) dailyReturns.push((dailyPortfolioValue - prevValue) / prevValue);
            }
        }

        if(portfolioValues.length < 2) {
             chartDiv.innerHTML = `<p style="text-align: center; padding: 50px;">Not enough historical data.</p>`;
             return;
        }

        const beginningValue = portfolioValues[0].value;
        const endingValue = portfolioValues[portfolioValues.length - 1].value;
        const annualizedReturn = Math.pow(endingValue / beginningValue, 1 / activeTimeframe) - 1;

        let weightedAnnualYield = 0;
        for (const item of portfolio.tickers) {
            const state = tickerState[item.ticker];
            if (state && state.priceCount > 0) {
                const avgPriceOfAsset = state.priceSum / state.priceCount;
                if (avgPriceOfAsset > 0 && state.shares > 0) {
                    const totalDividendPerShare = state.totalDividends / state.shares;
                    const avgYieldForPeriod = totalDividendPerShare / avgPriceOfAsset;
                    const annualizedYieldForAsset = avgYieldForPeriod / activeTimeframe;
                    weightedAnnualYield += annualizedYieldForAsset * (item.weight / 100);
                }
            }
        }
        
        const stdDev = calculateStdDev(dailyReturns) * Math.sqrt(252);

        returnResultEl.textContent = `${(annualizedReturn * 100).toFixed(2)}%`;
        stdDevResultEl.textContent = `${(stdDev * 100).toFixed(2)}%`;
        yieldResultEl.textContent = `${(weightedAnnualYield * 100).toFixed(2)}%`;
        plotChart(portfolioValues);
    }

    function getUserPortfolio() {
        const tickers = [];
        let totalWeight = 0;
        portfolioInputs.querySelectorAll('.portfolio-row').forEach(row => {
            const ticker = row.dataset.ticker;
            const weight = parseFloat(row.querySelector('.allocation-input').value) || 0;
            if (weight > 0) tickers.push({ ticker, weight });
            totalWeight += weight;
        });
        return { tickers, totalWeight };
    }
    
    function updateTotalAllocation(total) {
        totalAllocationEl.textContent = `Total Allocation: ${total.toFixed(0)}%`;
        totalAllocationEl.style.color = total === 100 ? 'green' : 'red';
    }

    function calculateStdDev(arr) {
        if (arr.length < 2) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((acc, val) => acc + (val - mean) ** 2, 0) / (arr.length - 1);
        return Math.sqrt(variance);
    }

    
    function drawPieChart(portfolio) {
        if (portfolio.tickers.length === 0 || portfolio.totalWeight === 0) {
            Plotly.purge(pieChartDiv); // Clear the chart if no data
            return;
        }

        const data = [{
            labels: portfolio.tickers.map(t => t.ticker),
            values: portfolio.tickers.map(t => t.weight),
            hovertext: portfolio.tickers.map(t => stockData[t.ticker][0].name),
            type: 'pie',
            hole: .4, 
            textinfo: 'label+percent',
            automargin: true
        }];

        const layout = {
            title: 'Portfolio Allocation',
            showlegend: false,
            height: 350,
            margin: { t: 50, b: 20, l: 20, r: 20 }
        };

        Plotly.newPlot(pieChartDiv, data, layout, {responsive: true});
    }
    
    function plotChart(portfolioValues) {
        const trace = {
            x: portfolioValues.map(v => v.date),
            y: portfolioValues.map(v => v.value),
            mode: 'lines', line: { color: '#3498db', width: 2 }, type: 'scatter'
        };
        const layout = {
            title: `Portfolio Performance (${activeTimeframe} Year)`,
            xaxis: { title: 'Date' }, yaxis: { title: 'Hypothetical Value ($)' },
            margin: { l: 70, r: 20, t: 50, b: 50 }, hovermode: 'x unified'
        };
        Plotly.newPlot(chartDiv, [trace], layout, { responsive: true });
    }

    init();
});