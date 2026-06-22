import { FaBoxes, FaSyncAlt, FaArrowLeft, FaChartBar } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const Header = () => {

    return (
        <header className="bg-white shadow-sm border-b border-gray-100 px-8 py-5 flex items-center justify-between">
            {/* Left: Title & Subtitle + Analytics button */}
            <div className="flex flex-wrap items-center gap-6">
                <Link to="/pedido-de-transporte" className="flex items-center gap-4 hover:opacity-90 transition-opacity">
                    <div className="p-3 bg-indigo-50 text-[#4f46e5] rounded-xl shrink-0">
                        <FaBoxes className="text-2xl" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 leading-tight">
                            Pedido de Transporte
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Visão consolidada do pedido de transporte
                        </p>
                    </div>
                </Link>
                <Link
                    to="/pedido-de-transporte/graficos"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 border border-indigo-600 rounded-xl hover:bg-indigo-700 hover:border-indigo-700 transition-all shadow-sm active:scale-95"
                    title="Análise Gráfico"
                >
                    <FaChartBar className="text-sm" />
                    <span>Análise Gráfico</span>
                </Link>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                <a
                    href="https://wp.processcloud.app/"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors"
                    title="Voltar ao Portal"
                >
                    <FaArrowLeft className="text-xs" />
                    <span>Voltar ao Portal</span>
                </a>
                <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                    title="Atualizar Página"
                >
                    <FaSyncAlt className="text-xs" />
                    <span>Atualizar</span>
                </button>
            </div>
        </header>
    );
};

export default Header;
