/**
 * HTF WDH ADX Calculations Table
 * 
 * Displays calculation rows for Multi_TF_Breakout_WDH_ADX strategy
 * Weekly/Daily/Hourly levels (NO Monthly) + Daily ADX column
 */

import type { HTFWDHADXCalculationRow } from '../types/HTFWDHADXCalculationRow';

interface HTFWDHADXCalculationsTableProps {
    calculations: HTFWDHADXCalculationRow[];
}

export function HTFWDHADXCalculationsTable({ calculations }: HTFWDHADXCalculationsTableProps) {
    const sortedCalculations = [...calculations].reverse();

    const fmt = (val: number | null) => val !== null ? val.toFixed(2) : '-';

    const ConditionBadge = ({ value, label }: { value: boolean; label: string }) => (
        <span
            className={`inline-flex px-1.5 py-0.5 rounded text-xs ${value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}
            title={label}
        >
            {value ? '✓' : '✗'}
        </span>
    );

    return (
        <div className="border-t border-gray-200 pt-6">
            <h5 className="text-gray-900 mb-4">
                WDH + Daily ADX Calculations ({calculations.length} bars - NO Monthly)
            </h5>
            <div className="overflow-x-auto">
                <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white z-10">
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-2 text-gray-700 whitespace-nowrap">Time</th>
                                <th className="text-right py-2 px-2 text-gray-700">O</th>
                                <th className="text-right py-2 px-2 text-gray-700">H</th>
                                <th className="text-right py-2 px-2 text-gray-700">L</th>
                                <th className="text-right py-2 px-2 text-gray-700">C</th>
                                <th className="text-right py-2 px-2 text-gray-700 bg-blue-50">1H H</th>
                                <th className="text-right py-2 px-2 text-gray-700 bg-blue-50">1H L</th>
                                <th className="text-right py-2 px-2 text-gray-700 bg-purple-50">Day H</th>
                                <th className="text-right py-2 px-2 text-gray-700 bg-purple-50">Day L</th>
                                <th className="text-right py-2 px-2 text-gray-700 bg-indigo-50">Wk H</th>
                                <th className="text-right py-2 px-2 text-gray-700 bg-indigo-50">Wk L</th>
                                {/* ADX Column - Daily */}
                                <th className="text-right py-2 px-2 text-gray-700 bg-amber-100 font-bold" title="Daily ADX (from completed candles)">ADX</th>
                                <th className="text-center py-2 px-2 text-gray-700" title="Close > All Highs (W/D/H)">C&gt;All</th>
                                <th className="text-center py-2 px-2 text-gray-700 bg-amber-50" title="ADX >= 25">ADX✓</th>
                                <th className="text-center py-2 px-2 text-gray-700" title="Reset Status">Rst</th>
                                <th className="text-center py-2 px-2 text-gray-700" title="Within Trading Window">Wnd</th>
                                <th className="text-center py-2 px-2 text-gray-700">Signal</th>
                                <th className="text-right py-2 px-2 text-gray-700">SL</th>
                                <th className="text-right py-2 px-2 text-gray-700">TP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCalculations.length === 0 ? (
                                <tr>
                                    <td colSpan={19} className="py-8 text-center text-gray-500">
                                        No calculations available. Run a backtest first.
                                    </td>
                                </tr>
                            ) : (
                                sortedCalculations.map((calc, index) => {
                                    const isSignalRow = calc.signal !== 'NONE';
                                    const isBlockedRow = calc.signalBlocked;
                                    const isBoundaryRow = calc.new1H || calc.newDay || calc.newWeek;
                                    const isADXBlocked = calc.blockedReason?.includes('ADX');

                                    let rowClass = 'border-b border-gray-100 hover:bg-gray-50';
                                    if (isSignalRow) {
                                        rowClass = calc.signal === 'BUY'
                                            ? 'border-b border-green-200 bg-green-50 hover:bg-green-100'
                                            : 'border-b border-red-200 bg-red-50 hover:bg-red-100';
                                    } else if (isADXBlocked) {
                                        rowClass = 'border-b border-orange-200 bg-orange-50';
                                    } else if (isBlockedRow) {
                                        rowClass = 'border-b border-yellow-200 bg-yellow-50';
                                    } else if (isBoundaryRow) {
                                        rowClass = 'border-b border-blue-100 bg-blue-50/30';
                                    }

                                    return (
                                        <tr key={`${calc.timestamp}-${index}`} className={rowClass}>
                                            <td className="py-2 px-2 text-gray-600 font-mono whitespace-nowrap">
                                                {calc.time}
                                                {calc.new1H && <span className="ml-1 text-blue-500" title="New Hour">⌚</span>}
                                                {calc.newDay && <span className="ml-1 text-purple-500" title="New Day">📅</span>}
                                                {calc.newWeek && <span className="ml-1 text-indigo-500" title="New Week">📆</span>}
                                            </td>
                                            <td className="py-2 px-2 text-right text-gray-600">{fmt(calc.open)}</td>
                                            <td className="py-2 px-2 text-right text-green-600">{fmt(calc.high)}</td>
                                            <td className="py-2 px-2 text-right text-red-600">{fmt(calc.low)}</td>
                                            <td className="py-2 px-2 text-right text-gray-900 font-semibold">{fmt(calc.close)}</td>

                                            {/* HTF Levels (NO Monthly) */}
                                            <td className={`py-2 px-2 text-right bg-blue-50 ${calc.closeAbove1HHigh ? 'text-green-600 font-bold' : 'text-gray-600'}`}>
                                                {fmt(calc.prev1HHigh)}
                                            </td>
                                            <td className={`py-2 px-2 text-right bg-blue-50 ${calc.closeBelow1HLow ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                                {fmt(calc.prev1HLow)}
                                            </td>
                                            <td className={`py-2 px-2 text-right bg-purple-50 ${calc.closeAboveDayHigh ? 'text-green-600 font-bold' : 'text-gray-600'}`}>
                                                {fmt(calc.prevDayHigh)}
                                            </td>
                                            <td className={`py-2 px-2 text-right bg-purple-50 ${calc.closeBelowDayLow ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                                {fmt(calc.prevDayLow)}
                                            </td>
                                            <td className={`py-2 px-2 text-right bg-indigo-50 ${calc.closeAboveWeekHigh ? 'text-green-600 font-bold' : 'text-gray-600'}`}>
                                                {fmt(calc.prevWeekHigh)}
                                            </td>
                                            <td className={`py-2 px-2 text-right bg-indigo-50 ${calc.closeBelowWeekLow ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                                {fmt(calc.prevWeekLow)}
                                            </td>

                                            {/* ADX Value - Daily */}
                                            <td className={`py-2 px-2 text-right font-bold bg-amber-100 ${calc.dailyADX === null ? 'text-gray-400' :
                                                    calc.dailyADX >= 25 ? 'text-green-700' : 'text-red-600'
                                                }`}>
                                                {calc.dailyADX !== null ? calc.dailyADX.toFixed(1) : '-'}
                                                {calc.dailyADX !== null && (
                                                    <span className="text-xs ml-1 text-gray-500">
                                                        ({calc.completedDailyCandles}d)
                                                    </span>
                                                )}
                                            </td>

                                            {/* Conditions */}
                                            <td className="py-2 px-2 text-center">
                                                <ConditionBadge value={calc.closeAboveAllHighs} label="Close > W/D/H Highs" />
                                            </td>
                                            <td className="py-2 px-2 text-center bg-amber-50">
                                                <ConditionBadge value={calc.adxConditionMet} label="ADX >= 25" />
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <ConditionBadge value={calc.longIsReset} label="Long Reset" />
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <ConditionBadge value={calc.withinTradingWindow} label="Trading Window" />
                                            </td>

                                            {/* Signal */}
                                            <td className="py-2 px-2 text-center">
                                                {calc.signal === 'NONE' ? (
                                                    calc.signalBlocked ? (
                                                        <span
                                                            className={`inline-flex px-2 py-0.5 rounded text-xs ${isADXBlocked ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
                                                                }`}
                                                            title={calc.blockedReason}
                                                        >
                                                            {isADXBlocked ? '📊' : '⛔'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )
                                                ) : (
                                                    <span
                                                        className={`inline-flex px-2 py-0.5 rounded-full text-white text-xs font-semibold ${calc.signal === 'BUY' ? 'bg-green-600' : 'bg-red-600'
                                                            }`}
                                                    >
                                                        {calc.signal}
                                                    </span>
                                                )}
                                            </td>

                                            {/* SL/TP */}
                                            <td className="py-2 px-2 text-right text-red-600">{fmt(calc.slPrice)}</td>
                                            <td className="py-2 px-2 text-right text-green-600">{fmt(calc.tpPrice)}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
                <span>🟢 BUY signal</span>
                <span className="text-orange-700">🟠 Entry blocked by ADX</span>
                <span>🟡 Entry blocked (waiting for pullback)</span>
                <span>⌚ New market hour</span>
                <span>📅 New day</span>
                <span>📆 New week</span>
                <span className="italic">(No Monthly condition)</span>
            </div>
        </div>
    );
}
