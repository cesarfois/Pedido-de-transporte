import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ChartTooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Cell
} from 'recharts';
import {
    FaChartBar,
    FaChartLine,
    FaArrowLeft,
    FaFilter,
    FaQuoteLeft,
    FaRobot,
    FaExclamationTriangle,
    FaCheckCircle,
    FaInfoCircle,
    FaCalendarAlt,
    FaUsers,
    FaSmile,
    FaMeh,
    FaFrown,
    FaSpinner,
    FaBuilding,
    FaExternalLinkAlt
} from 'react-icons/fa';
import { docuwareService } from '../services/docuwareService';

// Cabinet ID for 09 Frota
const CABINET_ID = '0b259206-b791-4bdd-a098-a85433c07d5b';

const GraficosPage = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rawDocs, setRawDocs] = useState([]);
    const [onlyNegatives, setOnlyNegatives] = useState(false);

    // Fetch documents on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);
                // Fetch up to 2000 documents of type "Pedido de Transporte"
                const response = await docuwareService.searchDocuments(
                    CABINET_ID,
                    [{ fieldName: 'TITULO', value: 'Pedido de Transporte' }],
                    2000
                );
                setRawDocs(response.items || []);
            } catch (err) {
                console.error('[Analytics] Error loading documents:', err);
                setError('Falha ao carregar dados do DocuWare. Verifique sua conexão.');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // 1. Normalization & Parsing logic
    const parseRating = (val) => {
        if (!val) return null;
        const s = String(val).trim();
        const match = s.match(/^([0-5])\s*-\s*/);
        if (match) {
            const num = parseInt(match[1]);
            return num === 0 ? null : num; // 0 is N/A
        }
        if (/^[1-5]$/.test(s)) return parseInt(s);
        
        const lower = s.toLowerCase();
        if (lower.includes('totalmente satisfeito')) return 5;
        if (lower.includes('muito satisfeito')) return 4;
        if (lower.includes('pouco satisfeito')) return 2;
        if (lower.includes('nada satisfeito')) return 1;
        if (lower.includes('satisfeito')) return 3;
        if (lower === 'bom' || lower === 'boa') return 4;
        return null;
    };

    const getDocFieldValue = (doc, fieldName) => {
        if (!doc || !doc.Fields) return '';
        const field = doc.Fields.find(f => f.FieldName === fieldName);
        if (!field) return '';
        return field.Item || field.Value || '';
    };

    const parseDWDate = (dateStr) => {
        if (!dateStr) return null;
        if (typeof dateStr === 'string' && dateStr.startsWith('/Date(')) {
            const match = dateStr.match(/-?\d+/);
            if (match) {
                const ts = parseInt(match[0]);
                return ts > 0 ? new Date(ts) : null;
            }
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    };

    // 2. Computed Analytics State
    const analyticsData = useMemo(() => {
        const evaluatedRequests = [];
        let totalEvaluationsCount = 0;

        rawDocs.forEach(doc => {
            // Extract raw fields
            const req = getDocFieldValue(doc, 'REQUERENTE') || 'Não Especificado';
            const dept = getDocFieldValue(doc, 'DEPARTAMENTO') || 'Não Especificado';
            const driverRcs = getDocFieldValue(doc, 'MOTORISTA');
            const driverG4s = getDocFieldValue(doc, 'MOTORISTA_G4S');
            const driver = driverRcs || driverG4s || 'Não Especificado';
            
            const rawDate = getDocFieldValue(doc, 'DATA_PEDIDO') || getDocFieldValue(doc, 'DATA_ACTIVIDADE') || getDocFieldValue(doc, 'DWSTOREDATETIME');
            const date = parseDWDate(rawDate);

            const comment = getDocFieldValue(doc, 'COMENTARIO') || getDocFieldValue(doc, 'COMENTARIO_2') || '';

            // Parse evaluations
            const evalAtraso = parseRating(getDocFieldValue(doc, 'AVALIACAO_ATRASO'));
            const evalComp = parseRating(getDocFieldValue(doc, 'AVALIACAO_COMPORTAMENTO'));
            const evalCond = parseRating(getDocFieldValue(doc, 'AVALIACAO_CONDUCAO'));
            const evalVeh = parseRating(getDocFieldValue(doc, 'AVALIACAO_ESTADO_VEICULO'));

            const validRatings = [evalAtraso, evalComp, evalCond, evalVeh].filter(r => r !== null);

            if (validRatings.length > 0) {
                const average = validRatings.reduce((acc, curr) => acc + curr, 0) / validRatings.length;
                totalEvaluationsCount++;

                evaluatedRequests.push({
                    id: doc.Id,
                    requester: req,
                    department: dept,
                    driver,
                    date,
                    comment,
                    averageRating: average,
                    ratings: {
                        atraso: evalAtraso,
                        comportamento: evalComp,
                        conducao: evalCond,
                        estadoVeiculo: evalVeh
                    },
                    viewUrl: docuwareService.getDocumentViewUrl(CABINET_ID, doc.Id)
                });
            }
        });

        // KPI Calculations
        const total = evaluatedRequests.length;
        const avgGlobal = total > 0
            ? evaluatedRequests.reduce((acc, r) => acc + r.averageRating, 0) / total
            : 0;

        const positiveCount = evaluatedRequests.filter(r => r.averageRating >= 3.5).length;
        const percentPositive = total > 0 ? (positiveCount / total) * 100 : 0;

        const negativeCount = evaluatedRequests.filter(r => r.averageRating < 2.5).length;

        // Rating Distribution
        const distCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        evaluatedRequests.forEach(r => {
            const rounded = Math.round(r.averageRating);
            if (rounded >= 1 && rounded <= 5) {
                distCounts[rounded]++;
            }
        });
        const distribution = Object.keys(distCounts).map(star => ({
            name: `${star} ★`,
            quantidade: distCounts[star],
            starNum: parseInt(star)
        }));

        // Monthly Evolution
        const monthGroups = {};
        evaluatedRequests.forEach(r => {
            if (!r.date) return;
            // Format YYYY-MM
            const monthStr = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthGroups[monthStr]) {
                monthGroups[monthStr] = { sum: 0, count: 0 };
            }
            monthGroups[monthStr].sum += r.averageRating;
            monthGroups[monthStr].count++;
        });

        const timeline = Object.keys(monthGroups)
            .sort()
            .map(m => {
                const parts = m.split('-');
                // Localized name, e.g. "Jan/26"
                const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
                const label = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                return {
                    key: m,
                    label,
                    media: parseFloat((monthGroups[m].sum / monthGroups[m].count).toFixed(2))
                };
            });

        // Driver Rankings
        const driverGroups = {};
        evaluatedRequests.forEach(r => {
            if (r.driver === 'Não Especificado') return;
            if (!driverGroups[r.driver]) {
                driverGroups[r.driver] = { sum: 0, count: 0 };
            }
            driverGroups[r.driver].sum += r.averageRating;
            driverGroups[r.driver].count++;
        });
        const driverRanking = Object.keys(driverGroups)
            .map(name => ({
                name,
                media: parseFloat((driverGroups[name].sum / driverGroups[name].count).toFixed(2)),
                count: driverGroups[name].count
            }))
            .sort((a, b) => b.media - a.media || b.count - a.count);

        // Department Rankings
        const deptGroups = {};
        evaluatedRequests.forEach(r => {
            if (r.department === 'Não Especificado') return;
            if (!deptGroups[r.department]) {
                deptGroups[r.department] = { sum: 0, count: 0 };
            }
            deptGroups[r.department].sum += r.averageRating;
            deptGroups[r.department].count++;
        });
        const deptRanking = Object.keys(deptGroups)
            .map(name => ({
                name,
                media: parseFloat((deptGroups[name].sum / deptGroups[name].count).toFixed(2)),
                count: deptGroups[name].count
            }))
            .sort((a, b) => b.media - a.media || b.count - a.count);

        // Feedback list
        const feedbacks = evaluatedRequests
            .filter(r => r.comment.trim() !== '')
            .map(r => {
                let sentiment = 'neutro';
                if (r.averageRating >= 3.5) sentiment = 'positivo';
                else if (r.averageRating < 2.5) sentiment = 'negativo';

                return {
                    id: r.id,
                    requester: r.requester,
                    driver: r.driver,
                    rating: parseFloat(r.averageRating.toFixed(1)),
                    comment: r.comment,
                    date: r.date ? r.date.toLocaleDateString('pt-BR') : '-',
                    sentiment,
                    viewUrl: r.viewUrl
                };
            })
            .sort((a, b) => {
                // Prioritize negative first, then by rating ascending
                if (a.sentiment === 'negativo' && b.sentiment !== 'negativo') return -1;
                if (b.sentiment === 'negativo' && a.sentiment !== 'negativo') return 1;
                return a.rating - b.rating;
            });

        return {
            totalEvaluations: total,
            avgSatisfaction: parseFloat(avgGlobal.toFixed(2)),
            percentPositive: parseFloat(percentPositive.toFixed(1)),
            negativeEvaluations: negativeCount,
            distribution,
            timeline,
            driverRanking,
            deptRanking,
            feedbacks
        };
    }, [rawDocs]);

    // Filter feedback based on user selection
    const filteredFeedbacks = useMemo(() => {
        if (onlyNegatives) {
            return analyticsData.feedbacks.filter(f => f.sentiment === 'negativo');
        }
        return analyticsData.feedbacks;
    }, [analyticsData.feedbacks, onlyNegatives]);

    // Render loading spinner
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <FaSpinner className="w-12 h-12 text-indigo-600 animate-spin" />
                <p className="text-slate-600 font-semibold animate-pulse">Carregando painel analítico do DocuWare...</p>
            </div>
        );
    }

    // Render error alert
    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-xl mx-auto space-y-4">
                <FaExclamationTriangle className="w-12 h-12 text-red-500 mx-auto" />
                <h3 className="text-lg font-bold text-red-800">Falha ao Inicializar Analytics</h3>
                <p className="text-sm text-red-600">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                    Tentar Novamente
                </button>
            </div>
        );
    }

    // Color definitions for bars
    const COLORS = ['#ef4444', '#f97316', '#eab308', '#06b6d4', '#10b981'];

    return (
        <div className="space-y-8 pb-12">
            {/* Top Bar with Navigation Link */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                            <FaChartBar className="text-2xl" />
                        </span>
                        Analytics de Satisfação
                    </h2>
                    <p className="text-sm text-slate-500">
                        Workflow de Pedido de Transporte • Monitoramento e Controle de Qualidade
                    </p>
                </div>
                <Link
                    to="/pedido-de-transporte"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-xl shadow-sm hover:shadow transition-all"
                >
                    <FaArrowLeft className="text-xs" />
                    <span>Voltar ao Controle</span>
                </Link>
            </div>

            {/* Main KPI Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Global Avg */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-500">Média de Satisfação</span>
                        <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">Geral</span>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-slate-950">{analyticsData.avgSatisfaction}</span>
                        <span className="text-sm text-slate-400">/ 5.0</span>
                    </div>
                    <div className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
                        <FaInfoCircle className="text-indigo-500 shrink-0" />
                        <span>Média ponderada de todas as respostas</span>
                    </div>
                </div>

                {/* Total Received */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-500">Total de Avaliações</span>
                        <span className="p-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">Respostas</span>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-slate-950">{analyticsData.totalEvaluations}</span>
                        <span className="text-sm text-slate-400">formulários</span>
                    </div>
                    <div className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
                        <FaCheckCircle className="text-emerald-500 shrink-0" />
                        <span>Pedidos de transporte respondidos</span>
                    </div>
                </div>

                {/* Positive % */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-500">Satisfação Positiva</span>
                        <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">Notas 4 e 5</span>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-slate-950">{analyticsData.percentPositive}%</span>
                    </div>
                    <div className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
                        <FaSmile className="text-emerald-500 shrink-0" />
                        <span>Avaliações com média superior ou igual a 3.5</span>
                    </div>
                </div>

                {/* Negatives Count */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-500">Alertas Negativos</span>
                        <span className="p-2 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold">Notas 1 e 2</span>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-slate-950">{analyticsData.negativeEvaluations}</span>
                        <span className="text-sm text-slate-400">críticas</span>
                    </div>
                    <div className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
                        <FaFrown className="text-rose-500 shrink-0" />
                        <span>Avaliações críticas que necessitam de contato</span>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Distribution Chart */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <FaChartBar className="text-indigo-500" />
                        Distribuição das Avaliações
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData.distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                                <ChartTooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-slate-950 text-white text-xs px-3 py-2 rounded-xl shadow-lg border-none font-semibold">
                                                    {payload[0].payload.name}: {payload[0].value} avaliações
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="quantidade" radius={[6, 6, 0, 0]}>
                                    {analyticsData.distribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[entry.starNum - 1] || '#6366f1'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Timeline Line Chart */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <FaChartLine className="text-indigo-500" />
                        Evolução Mensal da Satisfação
                    </h3>
                    <div className="h-72">
                        {analyticsData.timeline.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={analyticsData.timeline} margin={{ top: 10, right: 20, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} />
                                    <YAxis domain={[1, 5]} stroke="#94a3b8" fontSize={12} tickLine={false} />
                                    <ChartTooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-slate-950 text-white text-xs px-3 py-2 rounded-xl shadow-lg border-none font-semibold flex flex-col gap-0.5">
                                                        <span>Mês: {payload[0].payload.key}</span>
                                                        <span>Satisfação: {payload[0].value} ★</span>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="media"
                                        stroke="#4f46e5"
                                        strokeWidth={3}
                                        activeDot={{ r: 8 }}
                                        dot={{ stroke: '#4f46e5', strokeWidth: 2, fill: '#fff', r: 5 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                Dados insuficientes para traçar histórico mensal.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Rankings Grid Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Drivers Ranking */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FaUsers className="text-indigo-500" />
                        Qualidade por Motorista
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400 font-semibold text-xs">
                                    <th className="py-3">Motorista</th>
                                    <th className="py-3 text-center">Respostas</th>
                                    <th className="py-3 text-right">Nota Média</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-slate-700">
                                {analyticsData.driverRanking.slice(0, 5).map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-3 font-semibold text-slate-900">{row.name}</td>
                                        <td className="py-3 text-center text-slate-500">{row.count}</td>
                                        <td className="py-3 text-right font-bold">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs ${
                                                row.media >= 3.8 ? 'bg-emerald-50 text-emerald-700' :
                                                row.media >= 2.8 ? 'bg-amber-50 text-amber-700' :
                                                'bg-rose-50 text-rose-700'
                                            }`}>
                                                {row.media} ★
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {analyticsData.driverRanking.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="py-8 text-center text-slate-400">Nenhum motorista avaliado ainda.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Department Rankings */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FaBuilding className="text-indigo-500" />
                        Qualidade por Departamento Solicitante
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400 font-semibold text-xs">
                                    <th className="py-3">Departamento</th>
                                    <th className="py-3 text-center">Respostas</th>
                                    <th className="py-3 text-right">Nota Média</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-slate-700">
                                {analyticsData.deptRanking.slice(0, 5).map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-3 font-semibold text-slate-900">{row.name}</td>
                                        <td className="py-3 text-center text-slate-500">{row.count}</td>
                                        <td className="py-3 text-right font-bold">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs ${
                                                row.media >= 3.8 ? 'bg-emerald-50 text-emerald-700' :
                                                row.media >= 2.8 ? 'bg-amber-50 text-amber-700' :
                                                'bg-rose-50 text-rose-700'
                                            }`}>
                                                {row.media} ★
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {analyticsData.deptRanking.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="py-8 text-center text-slate-400">Nenhum departamento avaliado.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Comments Feedback Section */}
            <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <FaQuoteLeft className="text-indigo-500 text-sm shrink-0" />
                            Feedback dos Usuários
                        </h3>
                        <p className="text-xs text-slate-500">Comentários e sugestões extraídos dos workflows finalizados</p>
                    </div>

                    <button
                        onClick={() => setOnlyNegatives(!onlyNegatives)}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                            onlyNegatives
                                ? 'bg-rose-50 border-rose-200 text-rose-700'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <FaFilter className="text-[10px]" />
                        <span>Apenas Avaliações Negativas</span>
                    </button>
                </div>

                {/* Feedback List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredFeedbacks.map((f, idx) => (
                        <div
                            key={idx}
                            className={`p-6 rounded-2xl border relative flex flex-col justify-between hover:shadow transition-shadow group ${
                                f.sentiment === 'negativo'
                                    ? 'bg-rose-50/30 border-rose-100'
                                    : f.sentiment === 'neutro'
                                    ? 'bg-amber-50/30 border-amber-100'
                                    : 'bg-emerald-50/25 border-emerald-100'
                            }`}
                        >
                            {/* Document link on hover */}
                            <a
                                href={f.viewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir pedido no DocuWare Viewer"
                                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white rounded-xl shadow-sm text-slate-600 hover:text-indigo-600 hover:shadow"
                            >
                                <FaExternalLinkAlt className="text-xs" />
                            </a>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                                            f.sentiment === 'negativo' ? 'bg-rose-100 text-rose-800' :
                                            f.sentiment === 'neutro' ? 'bg-amber-100 text-amber-800' :
                                            'bg-emerald-100 text-emerald-800'
                                        }`}>
                                            {f.rating} ★
                                        </span>
                                        <span className="text-[11px] text-slate-400 font-semibold">{f.date}</span>
                                    </div>
                                </div>
                                <p className="text-slate-700 italic text-sm leading-relaxed pr-6">
                                    "{f.comment}"
                                </p>
                            </div>

                            <div className="border-t border-slate-100 mt-6 pt-4 flex items-center justify-between text-xs text-slate-500">
                                <div>
                                    <span className="font-semibold text-slate-700">Requerente:</span> {f.requester.split('@')[0]}
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-700">Motorista:</span> {f.driver}
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredFeedbacks.length === 0 && (
                        <div className="col-span-2 py-12 text-center text-slate-400 text-sm">
                            Nenhum comentário encontrado para os filtros selecionados.
                        </div>
                    )}
                </div>
            </div>

            {/* AI Teaser Area (Prepared layer for future integration) */}
            <div className="bg-gradient-to-r from-indigo-50/60 to-purple-50/60 border border-indigo-100 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow transition-shadow">
                <div className="space-y-2 max-w-xl">
                    <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FaRobot className="text-indigo-600 animate-bounce" />
                        Análise de Sentimentos por IA (Em Breve)
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Esta área foi estruturada e está pronta para receber integração com IA. Em breve, os comentários de feedback serão processados automaticamente para identificar sentimentos, destacar reclamações recorrentes e resumir os principais problemas de qualidade sem intervenção humana.
                    </p>
                </div>
                <div className="flex gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex flex-col items-center px-4 py-2 border-r border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sentimento</span>
                        <span className="text-xs font-extrabold text-slate-300 mt-1">Classificação</span>
                    </div>
                    <div className="flex flex-col items-center px-4 py-2 border-r border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Reclamações</span>
                        <span className="text-xs font-extrabold text-slate-300 mt-1">Clusters</span>
                    </div>
                    <div className="flex flex-col items-center px-4 py-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Resumo</span>
                        <span className="text-xs font-extrabold text-indigo-500 mt-1 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                            Pronto
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GraficosPage;
