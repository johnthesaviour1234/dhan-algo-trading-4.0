import type { CalculationRow } from '../types/CalculationRow';

interface CalculationsTableProps {
    calculations: CalculationRow[];
    strategyType: 'EMA' | 'SMA';
}

export function CalculationsTable({ calculations, strategyType }: CalculationsTableProps) {
    // Show most recent first
    const sortedCalculations = [...calculations].reverse();

    return (
        <div className="border-t border-gray-200 pt-6">
            <h5 className="text-gray-900 mb-4">
                Real-Time Calculations ({calculations.length} candles)
            </h5>
            <div className="overflow-x-auto">
                <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white z-10">
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-3 text-gray-700">Time</th>
                                <th className="text-right py-3 px-3 text-gray-700">Open</th>
                                <th className="text-right py-3 px-3 text-gray-700">High</th>
                                <th className="text-right py-3 px-3 text-gray-700">Low</th>
                                <th className="text-right py-3 px-3 text-gray-700">Close</th>
                                <th className="text-right py-3 px-3 text-gray-700">{strategyType} 3</th>
                                <th className="text-right py-3 px-3 text-gray-700">{strategyType} 15</th>
                                <th className="text-center py-3 px-3 text-gray-700">3 &gt; 15</th>
                                <th className="text-center py-3 px-3 text-gray-700">3 &lt; 15</th>
                                <th className="text-center py-3 px-3 text-gray-700">Signal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCalculations.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-8 text-center text-gray-500">
                                        No calculations yet. Waiting for candles...
                                    </td>
                                </tr>
                            ) : (
                                sortedCalculations.map((calc) => (
                                    <tr
                                        key={calc.timestamp}
                                        className={`border-b border-gray-100 hover:bg-gray-50 ${calc.signal !== 'NONE' ? 'bg-yellow-50' : ''
                                            }`}
                                    >
                                        <td className="py-3 px-3 text-gray-600 font-mono">{calc.time}</td>
                                        <td className="py-3 px-3 text-right text-gray-600">
                                            ₹{calc.open.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-3 text-right text-green-600">
                                            ₹{calc.high.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-3 text-right text-red-600">
                                            ₹{calc.low.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-3 text-right text-gray-900 font-semibold">
                                            ₹{calc.close.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-3 text-right text-blue-600">
                                            {calc.fastMA.toFixed(4)}
                                        </td>
                                        <td className="py-3 px-3 text-right text-purple-600">
                                            {calc.slowMA.toFixed(4)}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span
                                                className={`inline-flex px-2 py-0.5 rounded text-white text-xs ${calc.fastAboveSlow ? 'bg-green-600' : 'bg-gray-400'
                                                    }`}
                                            >
                                                {calc.fastAboveSlow ? '✓' : '✗'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span
                                                className={`inline-flex px-2 py-0.5 rounded text-white text-xs ${calc.fastBelowSlow ? 'bg-red-600' : 'bg-gray-400'
                                                    }`}
                                            >
                                                {calc.fastBelowSlow ? '✓' : '✗'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            {calc.signal === 'NONE' ? (
                                                <span className="text-gray-400 text-xs">-</span>
                                            ) : (
                                                <span
                                                    className={`inline-flex px-3 py-1 rounded-full text-white text-xs font-semibold ${calc.signal === 'BUY' ? 'bg-green-600' : 'bg-red-600'
                                                        }`}
                                                >
                                                    {calc.signal}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
