import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'
import { logger } from '../../utils/logger'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    logger.errorWithContext('ErrorBoundary capturó un error', error, {
      componentStack: errorInfo.componentStack,
    })
    
    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-8 max-w-md w-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Algo salió mal</h2>
                <p className="text-sm text-slate-500 mt-1">Se produjo un error inesperado</p>
              </div>
            </div>
            
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-slate-100 rounded-lg">
                <p className="text-xs font-mono text-red-600 break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase transition-all"
              >
                Recargar página
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold text-sm uppercase transition-all"
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
