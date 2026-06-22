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
    Cell,
    LabelList
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
    FaExternalLinkAlt,
    FaSearch,
    FaDownload
} from 'react-icons/fa';
import { docuwareService } from '../services/docuwareService';

// Cabinet ID for 09 Frota
const CABINET_ID = '0b259206-b791-4bdd-a098-a85433c07d5b';

const GraficosPage = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rawDocs, setRawDocs] = useState([]);
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'timeline'
    const [commentsTab, setCommentsTab] = useState('elogios'); // 'elogios' or 'sugestoes'
    const [expandedDriver, setExpandedDriver] = useState(null); // name of expanded driver for details
    const [activePillarDetail, setActivePillarDetail] = useState(null); // Selected pillar for modal analysis
    const [showTableLegend, setShowTableLegend] = useState(false); // Toggle explanation legend

    // Historical data states (Lazy loaded)
    const [historicalDocs, setHistoricalDocs] = useState([]);
    const [historicalLoading, setHistoricalLoading] = useState(false);
    const [historicalError, setHistoricalError] = useState(null);
    const [historicalLoaded, setHistoricalLoaded] = useState(false);

    // Date filter range state (default to last 30 days)
    const getTodayString = () => new Date().toISOString().split('T')[0];
    const getLast30DaysString = () => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    };
    const [dateRange, setDateRange] = useState([getLast30DaysString(), getTodayString()]);

    // Fetch documents function for dashboard
    const loadData = async (startDate, endDate) => {
        try {
            setLoading(true);
            setError(null);
            
            const queryFilters = [
                { fieldName: 'TITULO', value: 'Pedido de Transporte' }
            ];

            if (startDate && endDate) {
                queryFilters.push({
                    fieldName: 'DATA_PEDIDO',
                    value: [startDate, endDate]
                });
            }

            console.log('[Analytics] Loading documents with filters:', queryFilters);
            const response = await docuwareService.searchDocuments(
                CABINET_ID,
                queryFilters,
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

    // Fetch historical documents on demand (last 6 months)
    const loadHistoricalData = async () => {
        try {
            setHistoricalLoading(true);
            setHistoricalError(null);
            
            const d = new Date();
            d.setMonth(d.getMonth() - 5); // 6 months total including current month
            const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
            const endDate = getTodayString();
            
            const queryFilters = [
                { fieldName: 'TITULO', value: 'Pedido de Transporte' },
                { fieldName: 'DATA_PEDIDO', value: [startDate, endDate] }
            ];

            console.log('[Analytics] Loading 6-month historical documents:', queryFilters);
            const response = await docuwareService.searchDocuments(
                CABINET_ID,
                queryFilters,
                5000
            );
            setHistoricalDocs(response.items || []);
            setHistoricalLoaded(true);
        } catch (err) {
            console.error('[Analytics] Error loading historical documents:', err);
            setHistoricalError('Falha ao carregar dados históricos do DocuWare.');
        } finally {
            setHistoricalLoading(false);
        }
    };

    // Fetch documents on mount
    useEffect(() => {
        loadData(dateRange[0], dateRange[1]);
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
        const totalDocs = rawDocs.length;
        const participationRate = totalDocs > 0 ? (total / totalDocs) * 100 : 0;

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
        const distribution = Object.keys(distCounts)
            .reverse()
            .map(star => ({
                name: `${star} ★`,
                quantidade: distCounts[star],
                starNum: parseInt(star)
            }));

        // Count total requests (evaluated or not) per driver
        const driverTotalRequests = {};
        rawDocs.forEach(doc => {
            const driverRcs = getDocFieldValue(doc, 'MOTORISTA');
            const driverG4s = getDocFieldValue(doc, 'MOTORISTA_G4S');
            const driver = driverRcs || driverG4s || 'Não Especificado';
            if (driver !== 'Não Especificado') {
                driverTotalRequests[driver] = (driverTotalRequests[driver] || 0) + 1;
            }
        });

        // Driver Rankings with sub-criteria details (Atraso, Comportamento, Condução, Estado do Veículo)
        const driverGroups = {};
        let globalAtrasoSum = 0, globalAtrasoCount = 0;
        let globalComportamentoSum = 0, globalComportamentoCount = 0;
        let globalConducaoSum = 0, globalConducaoCount = 0;
        let globalEstadoVeiculoSum = 0, globalEstadoVeiculoCount = 0;

        evaluatedRequests.forEach(r => {
            if (r.driver === 'Não Especificado') return;
            if (!driverGroups[r.driver]) {
                driverGroups[r.driver] = { 
                    sum: 0, 
                    count: 0,
                    atrasoSum: 0,
                    atrasoCount: 0,
                    comportamentoSum: 0,
                    comportamentoCount: 0,
                    conducaoSum: 0,
                    conducaoCount: 0,
                    estadoVeiculoSum: 0,
                    estadoVeiculoCount: 0
                };
            }
            driverGroups[r.driver].sum += r.averageRating;
            driverGroups[r.driver].count++;

            // Accumulate individual criteria
            if (r.ratings.atraso !== null) {
                driverGroups[r.driver].atrasoSum += r.ratings.atraso;
                driverGroups[r.driver].atrasoCount++;
                globalAtrasoSum += r.ratings.atraso;
                globalAtrasoCount++;
            }
            if (r.ratings.comportamento !== null) {
                driverGroups[r.driver].comportamentoSum += r.ratings.comportamento;
                driverGroups[r.driver].comportamentoCount++;
                globalComportamentoSum += r.ratings.comportamento;
                globalComportamentoCount++;
            }
            if (r.ratings.conducao !== null) {
                driverGroups[r.driver].conducaoSum += r.ratings.conducao;
                driverGroups[r.driver].conducaoCount++;
                globalConducaoSum += r.ratings.conducao;
                globalConducaoCount++;
            }
            if (r.ratings.estadoVeiculo !== null) {
                driverGroups[r.driver].estadoVeiculoSum += r.ratings.estadoVeiculo;
                driverGroups[r.driver].estadoVeiculoCount++;
                globalEstadoVeiculoSum += r.ratings.estadoVeiculo;
                globalEstadoVeiculoCount++;
            }
        });

        const driverRanking = Object.keys(driverGroups)
            .map(name => {
                const g = driverGroups[name];
                return {
                    name,
                    media: parseFloat((g.sum / g.count).toFixed(2)),
                    count: g.count,
                    totalRequests: driverTotalRequests[name] || g.count,
                    criteria: {
                        atraso: g.atrasoCount > 0 ? parseFloat((g.atrasoSum / g.atrasoCount).toFixed(2)) : null,
                        comportamento: g.comportamentoCount > 0 ? parseFloat((g.comportamentoSum / g.comportamentoCount).toFixed(2)) : null,
                        conducao: g.conducaoCount > 0 ? parseFloat((g.conducaoSum / g.conducaoCount).toFixed(2)) : null,
                        estadoVeiculo: g.estadoVeiculoCount > 0 ? parseFloat((g.estadoVeiculoSum / g.estadoVeiculoCount).toFixed(2)) : null
                    }
                };
            })
            .sort((a, b) => b.media - a.media || b.count - a.count);

        // Global operational pillars averages
        const pillarsAverages = [
            { name: 'Pontualidade / Atraso', media: globalAtrasoCount > 0 ? parseFloat((globalAtrasoSum / globalAtrasoCount).toFixed(2)) : 0 },
            { name: 'Comportamento', media: globalComportamentoCount > 0 ? parseFloat((globalComportamentoSum / globalComportamentoCount).toFixed(2)) : 0 },
            { name: 'Condução', media: globalConducaoCount > 0 ? parseFloat((globalConducaoSum / globalConducaoCount).toFixed(2)) : 0 },
            { name: 'Estado do Veículo', media: globalEstadoVeiculoCount > 0 ? parseFloat((globalEstadoVeiculoSum / globalEstadoVeiculoCount).toFixed(2)) : 0 }
        ];

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
                    viewUrl: r.viewUrl,
                    ratings: r.ratings // Pass sub-ratings
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
            totalDocs,
            participationRate: parseFloat(participationRate.toFixed(1)),
            avgSatisfaction: parseFloat(avgGlobal.toFixed(2)),
            percentPositive: parseFloat(percentPositive.toFixed(1)),
            negativeEvaluations: negativeCount,
            distribution,
            driverRanking,
            deptRanking,
            feedbacks,
            pillarsAverages,
            rawEvaluations: evaluatedRequests
        };
    }, [rawDocs]);

    // Lazy load historical timeline calculations (last 6 months)
    const historicalTimeline = useMemo(() => {
        if (!historicalLoaded || historicalDocs.length === 0) return [];
        const evaluatedRequests = [];
        historicalDocs.forEach(doc => {
            const rawDate = getDocFieldValue(doc, 'DATA_PEDIDO') || getDocFieldValue(doc, 'DATA_ACTIVIDADE') || getDocFieldValue(doc, 'DWSTOREDATETIME');
            const date = parseDWDate(rawDate);
            const evalAtraso = parseRating(getDocFieldValue(doc, 'AVALIACAO_ATRASO'));
            const evalComp = parseRating(getDocFieldValue(doc, 'AVALIACAO_COMPORTAMENTO'));
            const evalCond = parseRating(getDocFieldValue(doc, 'AVALIACAO_CONDUCAO'));
            const evalVeh = parseRating(getDocFieldValue(doc, 'AVALIACAO_ESTADO_VEICULO'));
            const validRatings = [evalAtraso, evalComp, evalCond, evalVeh].filter(r => r !== null);
            if (validRatings.length > 0) {
                const average = validRatings.reduce((acc, curr) => acc + curr, 0) / validRatings.length;
                evaluatedRequests.push({ date, averageRating: average });
            }
        });

        const monthGroups = {};
        evaluatedRequests.forEach(r => {
            if (!r.date) return;
            const monthStr = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthGroups[monthStr]) {
                monthGroups[monthStr] = { sum: 0, count: 0 };
            }
            monthGroups[monthStr].sum += r.averageRating;
            monthGroups[monthStr].count++;
        });

        return Object.keys(monthGroups)
            .sort()
            .map(m => {
                const parts = m.split('-');
                const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
                const label = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                return {
                    key: m,
                    label,
                    media: parseFloat((monthGroups[m].sum / monthGroups[m].count).toFixed(2))
                };
            });
    }, [historicalDocs, historicalLoaded]);

    // Categorized Feedbacks (Elogios vs Sugestões)
    const categorizedFeedbacks = useMemo(() => {
        const elogios = analyticsData.feedbacks.filter(f => f.rating >= 3.5);
        const sugestoes = analyticsData.feedbacks.filter(f => f.rating < 3.5);
        return { elogios, sugestoes };
    }, [analyticsData.feedbacks]);
    
    // Dynamic XAxis domain min value calculation
    const xDomainMin = useMemo(() => {
        if (!analyticsData || !analyticsData.pillarsAverages) return 0;
        const medias = analyticsData.pillarsAverages.map(p => p.media).filter(m => m > 0);
        if (medias.length === 0) return 0;
        const minMedia = Math.min(...medias);
        // Round down slightly below the lowest score to zoom in clearly
        return Math.max(0, parseFloat((minMedia - 0.2).toFixed(1)));
    }, [analyticsData.pillarsAverages]);

    // Detail analysis data for a selected operational pillar
    const selectedPillarStats = useMemo(() => {
        if (!activePillarDetail) return null;
        
        // Map display name to rating key
        const keyMap = {
            'Pontualidade / Atraso': 'atraso',
            'Comportamento': 'comportamento',
            'Condução': 'conducao',
            'Estado do Veículo': 'estadoVeiculo'
        };
        const ratingKey = keyMap[activePillarDetail];
        if (!ratingKey) return null;

        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let totalCount = 0;
        let sum = 0;
        const relatedComments = [];

        rawDocs.forEach(doc => {
            const rawVal = getDocFieldValue(doc, ratingKey === 'atraso' ? 'AVALIACAO_ATRASO' : 
                                                 ratingKey === 'comportamento' ? 'AVALIACAO_COMPORTAMENTO' :
                                                 ratingKey === 'conducao' ? 'AVALIACAO_CONDUCAO' : 'AVALIACAO_ESTADO_VEICULO');
            const val = parseRating(rawVal);
            if (val !== null) {
                counts[val]++;
                totalCount++;
                sum += val;

                const comment = getDocFieldValue(doc, 'COMENTARIO') || getDocFieldValue(doc, 'COMENTARIO_2') || '';
                const driverRcs = getDocFieldValue(doc, 'MOTORISTA');
                const driverG4s = getDocFieldValue(doc, 'MOTORISTA_G4S');
                const driver = driverRcs || driverG4s || 'Não Especificado';
                const requester = getDocFieldValue(doc, 'REQUERENTE') || 'Não Especificado';
                const rawDate = getDocFieldValue(doc, 'DATA_PEDIDO') || getDocFieldValue(doc, 'DATA_ACTIVIDADE') || getDocFieldValue(doc, 'DWSTOREDATETIME');
                const date = parseDWDate(rawDate);

                if (comment.trim() !== '') {
                    relatedComments.push({
                        rating: val,
                        comment,
                        driver,
                        requester,
                        date: date ? date.toLocaleDateString('pt-BR') : '-',
                        docId: doc.Id,
                        viewUrl: docuwareService.getDocumentViewUrl(CABINET_ID, doc.Id)
                    });
                }
            }
        });

        const distribution = Object.keys(counts).map(star => ({
            star: `${star} ★`,
            count: counts[star],
            percentage: totalCount > 0 ? parseFloat(((counts[star] / totalCount) * 100).toFixed(1)) : 0
        }));

        // Sort comments: lower ratings first
        relatedComments.sort((a, b) => a.rating - b.rating);

        return {
            name: activePillarDetail,
            average: totalCount > 0 ? parseFloat((sum / totalCount).toFixed(2)) : 0,
            totalCount,
            distribution,
            comments: relatedComments
        };
    }, [activePillarDetail, rawDocs]);

    // Color definitions for bars
    const COLORS = ['#ef4444', '#f97316', '#eab308', '#06b6d4', '#10b981'];

    const handleExportDriversCSV = () => {
        const dataToExport = analyticsData?.driverRanking || [];
        if (dataToExport.length === 0) {
            alert('Não há dados de motoristas disponíveis no período selecionado para exportar.');
            return;
        }

        const headers = [
            'Motorista',
            'Pedidos',
            'Avaliações',
            'Pontualidade / Atraso',
            'Comportamento',
            'Condução',
            'Estado do Veículo',
            'Média Geral'
        ];

        const csvRows = [];
        // Add UTF-8 BOM so Excel opens it with correct encoding (accented characters)
        csvRows.push('\uFEFF' + headers.join(';'));

        dataToExport.forEach(row => {
            const csvRow = [
                `"${(row.name || '').replace(/"/g, '""')}"`,
                row.totalRequests,
                row.count,
                row.criteria.atraso !== null ? row.criteria.atraso : '',
                row.criteria.comportamento !== null ? row.criteria.comportamento : '',
                row.criteria.conducao !== null ? row.criteria.conducao : '',
                row.criteria.estadoVeiculo !== null ? row.criteria.estadoVeiculo : '',
                row.media !== null ? row.media : ''
            ];
            csvRows.push(csvRow.join(';'));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `ranking_motoristas_${dateRange[0]}_a_${dateRange[1]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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

            {/* Date Picker Bar */}
            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-wrap items-center gap-8">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-600 flex items-center gap-1.5 select-none">
                        Data Inicial:
                    </span>
                    <input
                        type="date"
                        value={dateRange[0]}
                        onChange={(e) => setDateRange([e.target.value, dateRange[1]])}
                        className="input input-sm input-bordered bg-white border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-slate-700 font-semibold shadow-sm w-44 h-10"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-600 flex items-center gap-1.5 select-none">
                        Data Final:
                    </span>
                    <input
                        type="date"
                        value={dateRange[1]}
                        onChange={(e) => setDateRange([dateRange[0], e.target.value])}
                        className="input input-sm input-bordered bg-white border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-slate-700 font-semibold shadow-sm w-44 h-10"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => loadData(dateRange[0], dateRange[1])}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all border-0 h-10 cursor-pointer"
                >
                    <FaSearch className="text-xs" />
                    <span>Pesquisar</span>
                </button>
            </div>

            {/* Tab Selection Bar */}
            <div className="flex flex-wrap border-b border-slate-200 gap-1 sm:gap-2">
                {[
                    { id: 'dashboard', label: 'Dashboard Geral' },
                    { id: 'drivers', label: 'Avaliação Motorista' },
                    { id: 'departments', label: 'Avaliação por Departamento' },
                    { id: 'feedback', label: 'Feedback dos Usuários' },
                    { id: 'timeline', label: 'Evolução Temporal' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 sm:px-6 py-3 font-bold text-sm border-b-2 transition-all ${
                            activeTab === tab.id
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <FaSpinner className="w-12 h-12 text-indigo-600 animate-spin" />
                    <p className="text-slate-600 font-semibold animate-pulse">Carregando painel analítico do DocuWare...</p>
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-xl mx-auto space-y-4">
                    <FaExclamationTriangle className="w-12 h-12 text-red-500 mx-auto" />
                    <h3 className="text-lg font-bold text-red-800">Falha ao Inicializar Analytics</h3>
                    <p className="text-sm text-red-600">{error}</p>
                    <button
                        onClick={() => loadData(dateRange[0], dateRange[1])}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                        Tentar Novamente
                    </button>
                </div>
            ) : (
                <>
                    {activeTab !== 'timeline' && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
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

                            {/* Total Requests */}
                            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-slate-500">Total de Pedidos</span>
                                    <span className="p-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">Finalizados</span>
                                </div>
                                <div className="mt-4 flex items-baseline gap-2">
                                    <span className="text-4xl font-extrabold text-slate-950">{analyticsData.totalDocs}</span>
                                    <span className="text-sm text-slate-400">pedidos</span>
                                </div>
                                <div className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
                                    <FaCheckCircle className="text-indigo-500 shrink-0" />
                                    <span>Viagens concluídas no período analisado</span>
                                </div>
                            </div>

                            {/* Total Received / Participation Rate */}
                            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-slate-500">Avaliações Recebidas</span>
                                    <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">Com Notas</span>
                                </div>
                                <div className="mt-4 flex items-baseline gap-2">
                                    <span className="text-4xl font-extrabold text-slate-950">{analyticsData.totalEvaluations}</span>
                                    <span className="text-sm text-slate-400">({analyticsData.participationRate}%)</span>
                                </div>
                                <div className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
                                    <FaSmile className="text-emerald-500 shrink-0" />
                                    <span>{analyticsData.percentPositive}% de satisfação positiva</span>
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
                    )}

                    {activeTab === 'dashboard' && (
                        <div className="space-y-8 animate-fade-in">
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

                                {/* Pillars Averages Bar Chart */}
                                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                        <FaChartBar className="text-indigo-500" />
                                        Comparativo de Pilares Operacionais (Causa Raiz)
                                    </h3>
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analyticsData.pillarsAverages} layout="vertical" margin={{ top: 10, right: 15, left: 35, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                <XAxis type="number" domain={[xDomainMin, 5]} stroke="#94a3b8" fontSize={12} tickLine={false} />
                                                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} width={120} />
                                                <ChartTooltip
                                                    cursor={{ fill: '#f8fafc' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-slate-950 text-white text-xs px-3 py-2 rounded-xl shadow-lg border-none font-semibold">
                                                                    {payload[0].payload.name}: {payload[0].value} ★ (Clique para ver detalhes)
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar 
                                                    dataKey="media" 
                                                    radius={[0, 6, 6, 0]}
                                                    onClick={(data) => {
                                                        if (data && data.name) {
                                                            setActivePillarDetail(data.name);
                                                        }
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    {analyticsData.pillarsAverages.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={['#ef4444', '#f97316', '#3b82f6', '#10b981'][index] || '#6366f1'} />
                                                    ))}
                                                    <LabelList dataKey="media" position="right" fontSize={11} fontWeight="bold" fill="#475569" formatter={(v) => `${v} ★`} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'drivers' && (
                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4 animate-fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <FaUsers className="text-indigo-500" />
                                    Qualidade por Motorista (Visão Detalhada)
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleExportDriversCSV}
                                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl transition-all border border-slate-200 bg-white cursor-pointer"
                                        title="Exportar dados de motoristas em CSV"
                                    >
                                        <FaDownload className="text-sm text-slate-500" />
                                        <span>Exportar CSV</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowTableLegend(!showTableLegend)}
                                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl transition-all border border-slate-200 bg-white cursor-pointer"
                                        title="Ver legenda de colunas"
                                    >
                                        <FaInfoCircle className="text-sm" />
                                        <span>Legenda das Colunas</span>
                                    </button>
                                </div>
                            </div>

                            {showTableLegend && (
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-xs text-slate-600 space-y-3 animate-fade-in">
                                    <h4 className="font-bold text-slate-800 text-sm">Metodologia e Origem dos Dados (DocuWare)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div>
                                            <p className="font-semibold text-slate-800">Pedidos</p>
                                            <p className="text-slate-500 mt-0.5">Total de documentos do tipo "Pedido de Transporte" finalizados no período.</p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800">Avaliações</p>
                                            <p className="text-slate-500 mt-0.5">Pedidos que receberam ao menos uma nota válida na pesquisa de satisfação.</p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800">Pontualidade / Atraso</p>
                                            <p className="text-slate-500 mt-0.5">Média das notas de pontualidade. Campo no DocuWare: <code className="bg-slate-200/50 px-1 py-0.5 rounded text-indigo-600">AVALIACAO_ATRASO</code></p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800">Comportamento</p>
                                            <p className="text-slate-500 mt-0.5">Média de conduta do motorista. Campo no DocuWare: <code className="bg-slate-200/50 px-1 py-0.5 rounded text-indigo-600">AVALIACAO_COMPORTAMENTO</code></p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800">Condução</p>
                                            <p className="text-slate-500 mt-0.5">Média de segurança na direção. Campo no DocuWare: <code className="bg-slate-200/50 px-1 py-0.5 rounded text-indigo-600">AVALIACAO_CONDUCAO</code></p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800">Estado Veículo</p>
                                            <p className="text-slate-500 mt-0.5">Média de conservação. Campo no DocuWare: <code className="bg-slate-200/50 px-1 py-0.5 rounded text-indigo-600">AVALIACAO_ESTADO_VEICULO</code></p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <p className="font-semibold text-indigo-600">Média Geral</p>
                                            <p className="text-slate-500 mt-0.5">Média aritmética simples de todos os critérios preenchidos (valores nulos ou "0 - N/A" são desconsiderados do cálculo).</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left table-auto">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-slate-400 font-semibold text-xs whitespace-nowrap">
                                            <th className="py-3 pr-4">Motorista</th>
                                            <th className="py-3 px-3 text-center">Pedidos</th>
                                            <th className="py-3 px-3 text-center">Avaliações</th>
                                            <th className="py-3 px-3 text-center">Pontualidade / Atraso</th>
                                            <th className="py-3 px-3 text-center">Comportamento</th>
                                            <th className="py-3 px-3 text-center">Condução</th>
                                            <th className="py-3 px-3 text-center">Estado Veículo</th>
                                            <th className="py-3 px-3 text-center">Média Geral</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-slate-700">
                                        {analyticsData.driverRanking.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors whitespace-nowrap">
                                                <td className="py-3.5 pr-4 font-semibold text-slate-900">{row.name}</td>
                                                <td className="py-3.5 px-3 text-center text-slate-500 font-medium">{row.totalRequests}</td>
                                                <td className="py-3.5 px-3 text-center text-slate-500 font-medium">{row.count}</td>
                                                {[
                                                    row.criteria.atraso,
                                                    row.criteria.comportamento,
                                                    row.criteria.conducao,
                                                    row.criteria.estadoVeiculo
                                                ].map((val, valIdx) => (
                                                    <td key={valIdx} className="py-3.5 px-3 text-center">
                                                        {val !== null ? (
                                                            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                                                                val >= 3.8 ? 'bg-emerald-50 text-emerald-600' :
                                                                val >= 2.8 ? 'bg-amber-50 text-amber-600' :
                                                                'bg-rose-50 text-rose-600'
                                                            }`}>
                                                                {val} ★
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 font-normal">-</span>
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="py-3.5 px-3 text-center font-bold">
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
                                                <td colSpan={8} className="py-8 text-center text-slate-400">Nenhum motorista avaliado ainda.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'departments' && (
                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4 animate-fade-in">
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
                                        {analyticsData.deptRanking.map((row, idx) => (
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
                    )}

                    {activeTab === 'feedback' && (
                        <div className="space-y-8 animate-fade-in">
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

                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button
                                            onClick={() => setCommentsTab('elogios')}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                                commentsTab === 'elogios'
                                                    ? 'bg-white text-emerald-700 shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-800'
                                            }`}
                                        >
                                            Elogios / Positivos ({categorizedFeedbacks.elogios.length})
                                        </button>
                                        <button
                                            onClick={() => setCommentsTab('sugestoes')}
                                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                                commentsTab === 'sugestoes'
                                                    ? 'bg-white text-rose-700 shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-800'
                                            }`}
                                        >
                                            Sugestões / Críticos ({categorizedFeedbacks.sugestoes.length})
                                        </button>
                                    </div>
                                </div>

                                {/* Feedback List */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {(commentsTab === 'elogios' ? categorizedFeedbacks.elogios : categorizedFeedbacks.sugestoes).map((f, idx) => (
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
                                            {/* Document link */}
                                            <a
                                                href={f.viewUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Abrir pedido no DocuWare Viewer"
                                                className="absolute top-4 right-4 p-2 bg-white rounded-xl shadow-sm text-slate-600 hover:text-indigo-600 hover:shadow transition-all border border-slate-100"
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
                                                {/* Sub-ratings badges */}
                                                {f.ratings && (
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {[
                                                            { label: 'Atraso', val: f.ratings.atraso },
                                                            { label: 'Comportamento', val: f.ratings.comportamento },
                                                            { label: 'Condução', val: f.ratings.conducao },
                                                            { label: 'Veículo', val: f.ratings.estadoVeiculo }
                                                        ].filter(item => item.val !== null).map((item, itemIdx) => (
                                                            <span key={itemIdx} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-semibold border border-slate-200/50">
                                                                {item.label}: {item.val} ★
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
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
                                    {(commentsTab === 'elogios' ? categorizedFeedbacks.elogios : categorizedFeedbacks.sugestoes).length === 0 && (
                                        <div className="col-span-2 py-12 text-center text-slate-400 text-sm">
                                            Nenhum feedback encontrado nesta categoria.
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
                    )}

                    {activeTab === 'timeline' && (
                        /* Evolução Temporal Tab (Lazy loaded) */
                        <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm space-y-6 animate-fade-in">
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <FaChartLine className="text-indigo-500" />
                                    Evolução Histórica da Satisfação
                                </h3>
                                <p className="text-sm text-slate-500">
                                    Acompanhe a tendência das notas médias de satisfação dos usuários ao longo dos meses.
                                </p>
                            </div>

                            {!historicalLoaded ? (
                                <div className="border border-slate-100 rounded-2xl p-10 text-center space-y-4 max-w-xl mx-auto">
                                    <FaInfoCircle className="w-12 h-12 text-slate-400 mx-auto" />
                                    <h4 className="text-md font-bold text-slate-800">Carregar Dados Históricos</h4>
                                    <p className="text-sm text-slate-500">
                                        Para otimizar a performance inicial do painel, a consulta de tendência histórica (últimos 6 meses) é processada sob demanda.
                                    </p>
                                    {historicalLoading ? (
                                        <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold">
                                            <FaSpinner className="animate-spin text-lg" />
                                            <span>Consultando o banco do DocuWare...</span>
                                        </div>
                                    ) : historicalError ? (
                                        <div className="space-y-2">
                                            <p className="text-sm text-red-600">{historicalError}</p>
                                            <button
                                                onClick={loadHistoricalData}
                                                className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all border-0 cursor-pointer"
                                            >
                                                Tentar Novamente
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={loadHistoricalData}
                                            className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow transition-all border-0 cursor-pointer"
                                        >
                                            Ver Evolução Histórica
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="h-96">
                                    {historicalTimeline.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={historicalTimeline} margin={{ top: 20, right: 30, left: -20, bottom: 10 }}>
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
                                            Nenhum dado encontrado para traçar o histórico mensal de satisfação.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Modal for Root Cause Analysis (Pillar Detail) */}
            {activePillarDetail && selectedPillarStats && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh] animate-scale-up text-left">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">
                                    Análise de Causa Raiz: {selectedPillarStats.name}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Média de {selectedPillarStats.average} ★ baseada em {selectedPillarStats.totalCount} avaliações
                                </p>
                            </div>
                            <button
                                onClick={() => setActivePillarDetail(null)}
                                className="p-2 hover:bg-slate-200/50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border-0 bg-transparent text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Distribution Bars */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Distribuição de Notas</h4>
                                <div className="space-y-2">
                                    {selectedPillarStats.distribution.slice().reverse().map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3 text-xs">
                                            <span className="w-10 text-slate-600 font-semibold">{item.star}</span>
                                            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        idx === 0 ? 'bg-emerald-500' :
                                                        idx === 1 ? 'bg-cyan-500' :
                                                        idx === 2 ? 'bg-amber-500' :
                                                        idx === 3 ? 'bg-orange-500' :
                                                        'bg-rose-500'
                                                    }`}
                                                    style={{ width: `${item.percentage}%` }}
                                                />
                                            </div>
                                            <span className="w-20 text-right text-slate-500 font-semibold">
                                                {item.count} ({item.percentage}%)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Qualitative Comments for this Pillar */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Comentários Relacionados</h4>
                                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                    {selectedPillarStats.comments.map((comment, idx) => (
                                        <div key={idx} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 relative group hover:border-slate-200 transition-colors">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                                        comment.rating >= 4 ? 'bg-emerald-50 text-emerald-700' :
                                                        comment.rating >= 3 ? 'bg-amber-50 text-amber-700' :
                                                        'bg-rose-50 text-rose-700'
                                                    }`}>
                                                        {comment.rating} ★
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">{comment.date}</span>
                                                </div>
                                                <a
                                                    href={comment.viewUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                                                >
                                                    Ver Pedido <FaExternalLinkAlt className="text-[8px]" />
                                                </a>
                                            </div>
                                            <p className="text-slate-700 italic text-xs leading-relaxed">
                                                "{comment.comment}"
                                            </p>
                                            <div className="mt-3 pt-2 border-t border-slate-100/50 flex justify-between text-[10px] text-slate-500">
                                                <span>Requerente: {comment.requester.split('@')[0]}</span>
                                                <span>Motorista: {comment.driver}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {selectedPillarStats.comments.length === 0 && (
                                        <p className="text-center text-slate-400 text-xs py-8">
                                            Nenhum comentário associado a este pilar.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/30">
                            <button
                                onClick={() => setActivePillarDetail(null)}
                                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border-0"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleUp {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-fade-in {
                    animation: fadeIn 0.2s ease-out forwards;
                }
                .animate-scale-up {
                    animation: scaleUp 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default GraficosPage;
