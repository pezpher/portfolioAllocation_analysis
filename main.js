document.addEventListener('DOMContentLoaded', () => {
    const timeframeButtons = document.querySelector('.timeframe-buttons');
    const resultsBody = document.getElementById('results-body');
    const chartDiv = document.getElementById('chart');

    let stockData = {};
    let activeTimeframe = 5;

    const ASSET_CLASSES = {
        'DFAC': 'Equity', 'DFAX': 'Equity', 'SGIIX': 'Equity', 'DUHP': 'Equity',
        'QQQM': 'Equity', 'BPTIX': 'Equity', 'CPIEX': 'Equity', 'DFAT': 'Equity',
        'GSMIX': 'Equity', 'IWB': 'Equity', 'IWM': 'Equity', 'IWV': 'Equity',
        'ACWI': 'Equity', 'EFA': 'Equity', 'VSS': 'Equity', 'ACWX': 'Equity',
        'IVV': 'Equity', 'VNQ': 'Equity', 'GLD': 'Equity', 'BIZD': 'Equity', 'GBTC': 'Equity',
        'PTSNX': 'Fixed Income', 'MQLIX': 'Fixed Income', 'PIPNX': 'Fixed Income',
        'GIUSX': 'Fixed Income', 'CPITX': 'Fixed Income', 'IAGG': 'Fixed Income',
        'AGG': 'Fixed Income', 'VTC': 'Fixed Income', 'MUB': 'Fixed Income',
        'BIL': 'Fixed Income', 'VPC': 'Fixed Income',
        'CASH': 'Cash'
    };

    const PREMADE_PORTFOLIOS = {
        "100/0 CORE": [
            { ticker: "DFAC", weight: 40.60 }, { ticker: "DFAX", weight: 19.10 },
            { ticker: "SGIIX", weight: 5.97 }, { ticker: "DUHP", weight: 4.98 },
            { ticker: "QQQM", weight: 3.98 }, { ticker: "BPTIX", weight: 5.97 },
            { ticker: "CPIEX", weight: 5.97 }, { ticker: "DFAT", weight: 4.97 },
            { ticker: "GSMIX", weight: 7.96 }, { ticker: "CASH", weight: 0.50 }
        ],
        "0/100 CORE": [
            { ticker: "CASH", weight: 0.50 }, { ticker: "PTSNX", weight: 14.22 },
            { ticker: "MQLIX", weight: 14.22 }, { ticker: "PIPNX", weight: 21.32 },
            { ticker: "GIUSX", weight: 21.32 }, { ticker: "CPITX", weight: 28.43 }
        ]
    };

    async function init() {
        try {
            const rawData = await loadCSVData('stockData.csv');
            if (rawData.length === 0) throw new Error("CSV data is empty or failed to load.");

            stockData = groupDataByTicker(rawData);
            stockData['CASH'] = generateCashData(rawData);

            const availableTickers = Object.keys(stockData).sort((a, b) => stockData[a][0].name.localeCompare(stockData[b][0].name));

            setupPortfolioUI('a', availableTickers);
            setupPortfolioUI('b', availableTickers);

            timeframeButtons.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    activeTimeframe = parseInt(e.target.dataset.years, 10);
                    timeframeButtons.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                    runAnalysis();
                }
            });

            runAnalysis();

        } catch (error) {
            console.error("Initialization failed:", error);
            chartDiv.innerHTML = `<p style="color: red; text-align: center;">Error: Could not load or process stockData.csv. Please ensure the file is present and contains valid data.</p>`;
        }
    }

    function generateCashData(templateData) {
        const uniqueDates = [...new Set(templateData.map(d => d.date.toISOString().split('T')[0]))].sort();
        return uniqueDates.map(dateStr => ({
            date: new Date(dateStr),
            ticker: 'CASH',
            name: 'Cash',
            price: 1,
            dividend: 0
        }));
    }

    function setupPortfolioUI(portfolioId, tickers) {
        const tickerSelect = document.getElementById(`ticker-select-${portfolioId}`);
        const addTickerBtn = document.getElementById(`add-ticker-btn-${portfolioId}`);
        const portfolioInputs = document.getElementById(`portfolio-${portfolioId}-inputs`);
        const presetButtons = document.querySelectorAll(`.preset-btn[data-portfolio="${portfolioId.toUpperCase()}"]`);

        tickers.forEach(ticker => {
            const option = document.createElement('option');
            option.value = ticker;
            option.textContent = stockData[ticker][0].name;
            tickerSelect.appendChild(option);
        });

        addTickerBtn.addEventListener('click', () => {
            addPortfolioRow(tickerSelect.value, portfolioId, 10);
            runAnalysis();
        });

        presetButtons.forEach(button => {
            button.addEventListener('click', () => {
                const presetName = button.dataset.preset;
                loadPremadePortfolio(presetName, portfolioId);
                runAnalysis();
            });
        });
    }

    function addPortfolioRow(ticker, portfolioId, weight) {
        if (!stockData[ticker]) return;
        const portfolioInputs = document.getElementById(`portfolio-${portfolioId}-inputs`);
        if (portfolioInputs.querySelector(`[data-ticker="${ticker}"]`)) {
            alert(`${stockData[ticker][0].name} is already in Portfolio ${portfolioId.toUpperCase()}.`);
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
            <input type="number" class="allocation-input" value="${weight}" min="0" max="100" placeholder="%">
            <button class="remove-btn">Remove</button>
        `;
        portfolioInputs.appendChild(row);

        row.querySelector('.allocation-input').addEventListener('input', runAnalysis);
        row.querySelector('.remove-btn').addEventListener('click', () => {
            row.remove();
            runAnalysis();
        });
    }

    function loadPremadePortfolio(presetName, portfolioId) {
        const portfolioInputs = document.getElementById(`portfolio-${portfolioId}-inputs`);
        portfolioInputs.innerHTML = '';
        const portfolioData = PREMADE_PORTFOLIOS[presetName];
        if (!portfolioData) return;

        portfolioData.forEach(asset => {
            addPortfolioRow(asset.ticker, portfolioId, asset.weight);
        });
    }

    async function loadCSVData(filePath) {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csvText = await response.text();
        return csvText.split('\n').slice(1).map(line => {
            const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if(parts.length < 5) return null;
            const [date, ticker, name, price, dividend] = parts;
            return { date: new Date(date), ticker: ticker?.trim(), name: name?.trim().replace(/"/g, ''), price: parseFloat(price), dividend: parseFloat(dividend) };
        }).filter(row => row && row.ticker && row.date && !isNaN(row.price) && !isNaN(row.date.getTime()));
    }

    function groupDataByTicker(data) {
        return data.reduce((acc, row) => {
            if (!acc[row.ticker]) acc[row.ticker] = [];
            acc[row.ticker].push(row);
            return acc;
        }, {});
    }

    function getUserPortfolio(portfolioId) {
        const portfolioInputs = document.getElementById(`portfolio-${portfolioId}-inputs`);
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

    function calculateStdDev(arr) {
        if (arr.length < 2) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((acc, val) => acc + (val - mean) ** 2, 0) / (arr.length - 1);
        return Math.sqrt(variance);
    }

    function runAnalysis() {
        const portfolioA = getUserPortfolio('a');
        const portfolioB = getUserPortfolio('b');

        updateTotalAllocation('a', portfolioA.totalWeight);
        updateTotalAllocation('b', portfolioB.totalWeight);

        drawPieChart('a', portfolioA);
        drawPieChart('b', portfolioB);

        const analysisA = (portfolioA.tickers.length > 0 && Math.abs(portfolioA.totalWeight - 100) < 0.1) ? calculatePortfolioPerformance(portfolioA) : null;
        const analysisB = (portfolioB.tickers.length > 0 && Math.abs(portfolioB.totalWeight - 100) < 0.1) ? calculatePortfolioPerformance(portfolioB) : null;

        plotComparisonChart(analysisA, analysisB);
        renderResultsTable(analysisA, analysisB);
    }

    function calculatePortfolioPerformance(portfolio) {
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
        if (sortedDates.length < 2) return null;

        let portfolioHistory = [];
        let dailyReturns = [];
        const initialValue = 10000;
        let cash = 0;
        let lastRebalanceYear = new Date(sortedDates[0]).getFullYear();

        let tickerState = {};
        portfolio.tickers.forEach(item => {
            tickerState[item.ticker] = { shares: 0 };
        });

        const rebalance = (valueToAllocate, rebalanceDayData) => {
            for (const item of portfolio.tickers) {
                const price = rebalanceDayData[item.ticker]?.price;
                if (price > 0) {
                    tickerState[item.ticker].shares = (valueToAllocate * (item.weight / 100)) / price;
                }
            }
        };
        
        rebalance(initialValue, dateLookup.get(sortedDates[0]));

        for (let i = 0; i < sortedDates.length; i++) {
            const dateStr = sortedDates[i];
            const date = new Date(dateStr);
            const currentDayData = dateLookup.get(dateStr);
            let dailyPortfolioValue = 0;
            let isDataComplete = true;

            for (const item of portfolio.tickers) {
                 if (!currentDayData[item.ticker]) { 
                    isDataComplete = false; 
                    break; 
                }
            }

            if (!isDataComplete) {
                if(portfolioHistory.length > 0) {
                     portfolioHistory.push({ date: date, value: portfolioHistory[portfolioHistory.length-1].value });
                }
                continue;
            }

            let marketValue = 0;
            for (const item of portfolio.tickers) {
                const tickerData = currentDayData[item.ticker];
                const shareCount = tickerState[item.ticker].shares;
                marketValue += shareCount * tickerData.price;
                cash += shareCount * tickerData.dividend;
            }
            dailyPortfolioValue = marketValue + cash;

            if (date.getFullYear() > lastRebalanceYear) {
                lastRebalanceYear = date.getFullYear();
                rebalance(dailyPortfolioValue, currentDayData);
                cash = 0; 
                
                marketValue = 0;
                 for (const item of portfolio.tickers) {
                    const tickerData = currentDayData[item.ticker];
                    marketValue += tickerState[item.ticker].shares * tickerData.price;
                }
                dailyPortfolioValue = marketValue;
            }

            const prevValue = portfolioHistory.length > 0 ? portfolioHistory[portfolioHistory.length - 1].value : initialValue;
            if(prevValue > 0) dailyReturns.push((dailyPortfolioValue - prevValue) / prevValue);
            portfolioHistory.push({ date: date, value: dailyPortfolioValue });
        }

        if (portfolioHistory.length < 2) return null;

        const metrics = calculateMetrics(portfolioHistory, dailyReturns, portfolio, dateLookup);
        return { portfolio, history: portfolioHistory, metrics };
    }

    function calculateMetrics(history, dailyReturns, userPortfolio, dateLookup) {
        const beginningValue = history[0].value;
        const endingValue = history[history.length - 1].value;
        const years = (history[history.length - 1].date - history[0].date) / (1000 * 60 * 60 * 24 * 365.25);

        const totalCAGR = (years > 0) ? Math.pow(endingValue / beginningValue, 1 / years) - 1 : 0;
        const totalStdDev = calculateStdDev(dailyReturns) * Math.sqrt(252);
        let totalWeightedYield = 0;

        const results = {
            total: {},
            byClass: { Equity: { tickers: [] }, 'Fixed Income': { tickers: [] }, Cash: { tickers: [] } },
            byTicker: {}
        };

        for (const item of userPortfolio.tickers) {
            const ticker = item.ticker;
            const assetClass = ASSET_CLASSES[ticker] || 'Other';
            
            const tickerHistory = history.map(h => {
                const dayData = dateLookup.get(h.date.toISOString().split('T')[0]);
                return (dayData && dayData[ticker]) ? dayData[ticker].price : null;
            }).filter(p => p !== null);

            if (tickerHistory.length < 2) continue;
            
            const relevantDividends = stockData[ticker].filter(d => d.date >= history[0].date && d.date <= history[history.length-1].date);
            const totalDividendsPaid = relevantDividends.reduce((sum, day) => sum + day.dividend, 0);

            const tickerDailyReturns = [];
            for (let i = 1; i < tickerHistory.length; i++) {
                if(tickerHistory[i-1] > 0) tickerDailyReturns.push((tickerHistory[i] - tickerHistory[i-1]) / tickerHistory[i-1]);
            }

            const endPrice = tickerHistory[tickerHistory.length-1];
            const startPrice = tickerHistory[0];

            const priceCAGR = (years > 0 && startPrice > 0) ? Math.pow(endPrice / startPrice, 1 / years) - 1 : 0;
            const tickerStdDev = calculateStdDev(tickerDailyReturns) * Math.sqrt(252);
            
            const avgPrice = tickerHistory.reduce((sum, p) => sum + p, 0) / tickerHistory.length;
            const annualDividend = totalDividendsPaid / years;
            const tickerYield = (avgPrice > 0) ? annualDividend / avgPrice : 0;
            
            const tickerTotalReturnCAGR = (1 + priceCAGR) * (1 + tickerYield) - 1;
            
            totalWeightedYield += tickerYield * (item.weight / 100);

            const tickerMetrics = { cagr: tickerTotalReturnCAGR, stdDev: tickerStdDev, yield: tickerYield, weight: item.weight };
            results.byTicker[ticker] = tickerMetrics;
            if (results.byClass[assetClass]) {
                results.byClass[assetClass].tickers.push({ ticker, ...tickerMetrics });
            }
        }
        
        results.total = { cagr: totalCAGR, stdDev: totalStdDev, yield: totalWeightedYield };

        for (const className in results.byClass) {
            const classInfo = results.byClass[className];
            if (classInfo.tickers.length > 0) {
                let classCAGR = 0, classStdDev = 0, classYield = 0, totalClassWeight = 0;
                classInfo.tickers.forEach(t => {
                    totalClassWeight += t.weight;
                });

                if (totalClassWeight > 0) {
                    classInfo.tickers.forEach(t => {
                        const weightInClass = t.weight / totalClassWeight;
                        classCAGR += t.cagr * weightInClass;
                        classStdDev += t.stdDev * weightInClass;
                        classYield += t.yield * weightInClass;
                    });
                    classInfo.metrics = {
                        cagr: classCAGR,
                        stdDev: classStdDev,
                        yield: classYield
                    };
                }
            }
        }
        return results;
    }

    function updateTotalAllocation(portfolioId, total) {
        const totalAllocationEl = document.getElementById(`total-allocation-${portfolioId}`);
        totalAllocationEl.textContent = `Total Allocation: ${total.toFixed(0)}%`;
        totalAllocationEl.style.color = Math.abs(total - 100) < 0.1 ? 'green' : 'red';
    }

    function drawPieChart(portfolioId, portfolio) {
        const pieChartDiv = document.getElementById(`pie-chart-${portfolioId}`);
        if (portfolio.tickers.length === 0 || portfolio.totalWeight === 0) {
            Plotly.purge(pieChartDiv);
            return;
        }
        const data = [{
            labels: portfolio.tickers.map(t => t.ticker),
            values: portfolio.tickers.map(t => t.weight),
            hovertext: portfolio.tickers.map(t => stockData[t.ticker][0].name),
            type: 'pie', hole: .4, textinfo: 'label+percent', automargin: true
        }];
        const layout = {
            showlegend: false, height: 350,
            margin: { t: 20, b: 20, l: 20, r: 20 }
        };
        Plotly.newPlot(pieChartDiv, data, layout, { responsive: true });
    }

    function plotComparisonChart(analysisA, analysisB) {
        const traces = [];
        if (analysisA && analysisA.history.length > 0) {
            traces.push({
                x: analysisA.history.map(v => v.date),
                y: analysisA.history.map(v => v.value),
                mode: 'lines', name: 'Portfolio A', line: { color: '#3498db', width: 2 }
            });
        }
        if (analysisB && analysisB.history.length > 0) {
            traces.push({
                x: analysisB.history.map(v => v.date),
                y: analysisB.history.map(v => v.value),
                mode: 'lines', name: 'Portfolio B', line: { color: '#e74c3c', width: 2 }
            });
        }

        const layout = {
            title: `Portfolio Performance Comparison (${activeTimeframe} Year)`,
            xaxis: { title: 'Date' }, yaxis: { title: 'Hypothetical Value ($)' },
            margin: { l: 70, r: 20, t: 50, b: 50 }, hovermode: 'x unified',
            legend: { x: 0.05, y: 0.95 }
        };

        if (traces.length === 0) {
            Plotly.purge(chartDiv);
            chartDiv.innerHTML = `<p style="text-align: center; padding: 50px;">Build a portfolio and ensure total allocation is 100% to see analysis.</p>`;
            return;
        }

        Plotly.newPlot(chartDiv, traces, layout, { responsive: true });
    }

    function renderResultsTable(analysisA, analysisB) {
        resultsBody.innerHTML = '';
        if (analysisA && analysisA.metrics) renderPortfolioMetrics(resultsBody, "Portfolio A", analysisA);
        if (analysisB && analysisB.metrics) renderPortfolioMetrics(resultsBody, "Portfolio B", analysisB);
    }

    function renderPortfolioMetrics(tbody, name, analysisData) {
        const pMetrics = analysisData.metrics;
        const toPct = (val) => (val * 100).toFixed(2) + '%';
        if (!pMetrics || !pMetrics.total) return;

        let totalRow = `<tr class="total-row"><td>${name} (Total)</td><td>${toPct(pMetrics.total.cagr)}</td><td>${toPct(pMetrics.total.stdDev)}</td><td>${toPct(pMetrics.total.yield)}</td></tr>`;
        tbody.innerHTML += totalRow;

        for (const className of ['Equity', 'Fixed Income', 'Cash']) {
            const classInfo = pMetrics.byClass[className];
            if (classInfo && classInfo.tickers.length > 0) {
                const metrics = classInfo.metrics;
                let categoryRow = `<tr class="category-row"><td>${className}</td><td>${metrics ? toPct(metrics.cagr) : '-'}</td><td>${metrics ? toPct(metrics.stdDev) : '-'}</td><td>${metrics ? toPct(metrics.yield) : '-'}</td></tr>`;
                let tickersRows = '';
                classInfo.tickers.forEach(t => {
                    tickersRows += `<tr class="ticker-row">
                        <td>${stockData[t.ticker][0].name} (${t.ticker})</td>
                        <td>${toPct(t.cagr)}</td>
                        <td>${toPct(t.stdDev)}</td>
                        <td>${toPct(t.yield)}</td>
                    </tr>`;
                });
                tbody.innerHTML += categoryRow + tickersRows;
            }
        }
    }

    init();
});