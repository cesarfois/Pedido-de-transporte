import { FaChartBar, FaChartLine, FaChartPie, FaInbox, FaUsers, FaTasks } from 'react-icons/fa';

const GraficosPage = () => {
    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                        <FaChartBar className="text-xl" />
                    </span>
                    Gráficos e Análises
                </h2>
                <p className="text-slate-500 mt-4 leading-relaxed max-w-3xl text-base">
                    Área destinada à visualização de gráficos, análises e indicadores dos workflows.
                    Em breve serão adicionados painéis analíticos por processo.
                </p>
            </div>

            {/* Preview Grid for future analytics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metric 1 Placeholder */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FaChartLine className="text-6xl text-indigo-600" />
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <FaTasks className="text-xl" />
                        </div>
                        <h3 className="font-semibold text-slate-800 text-lg">Pedidos Processados</h3>
                    </div>
                    <div className="h-28 flex flex-col justify-end">
                        <div className="text-3xl font-extrabold text-slate-300">--</div>
                        <p className="text-xs text-slate-400 mt-2">Métricas de tempo de resposta e volume</p>
                    </div>
                </div>

                {/* Metric 2 Placeholder */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FaChartPie className="text-6xl text-cyan-600" />
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
                            <FaInbox className="text-xl" />
                        </div>
                        <h3 className="font-semibold text-slate-800 text-lg">Distribuição por Status</h3>
                    </div>
                    <div className="h-28 flex flex-col justify-end">
                        <div className="text-3xl font-extrabold text-slate-300">--</div>
                        <p className="text-xs text-slate-400 mt-2">Visão geral do andamento por etapas</p>
                    </div>
                </div>

                {/* Metric 3 Placeholder */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FaChartBar className="text-6xl text-emerald-600" />
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <FaUsers className="text-xl" />
                        </div>
                        <h3 className="font-semibold text-slate-800 text-lg">Desempenho de Equipes</h3>
                    </div>
                    <div className="h-28 flex flex-col justify-end">
                        <div className="text-3xl font-extrabold text-slate-300">--</div>
                        <p className="text-xs text-slate-400 mt-2">KPIs de eficiência operacional e aprovações</p>
                    </div>
                </div>
            </div>

            {/* Future panel teaser section */}
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <div className="max-w-md mx-auto space-y-4">
                    <div className="w-16 h-16 bg-white border border-slate-100 shadow-sm text-indigo-500 rounded-full flex items-center justify-center mx-auto">
                        <FaChartBar className="text-2xl animate-pulse" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Painéis de Indicadores em Construção</h3>
                    <p className="text-sm text-slate-500">
                        Estamos preparando relatórios dinâmicos integrados em tempo real com o fluxo do Pedido de Transporte.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GraficosPage;
