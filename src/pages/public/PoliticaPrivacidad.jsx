import { Link } from 'react-router-dom'
import { Stethoscope, ArrowLeft } from 'lucide-react'

export default function PoliticaPrivacidad() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* NAVBAR */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tight">QuirúrgicaPro</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>
      </nav>

      {/* CONTENT */}
      <main className="pt-28 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-2">
            Política de Privacidad
          </h1>
          <p className="text-slate-500 text-sm mb-10">
            Última actualización: {new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">1. Identificación del responsable</h2>
              <p>
                QuirúrgicaPro es un software de gestión quirúrgica para clínicas dentales, desarrollado y operado en Chile.
                Como responsable del tratamiento de datos personales, actuamos conforme a la <strong>Ley N° 19.628 sobre Protección de la Vida Privada</strong> y sus modificaciones.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">2. Datos que recopilamos</h2>
              <p className="mb-3">Recopilamos únicamente los datos necesarios para la operación del sistema:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Datos del personal médico:</strong> nombre, RUT, especialidad, correo electrónico y teléfono de contacto.</li>
                <li><strong>Datos de pacientes:</strong> nombre, RUT y fecha de nacimiento, utilizados exclusivamente para identificar al paciente en el contexto de procedimientos quirúrgicos.</li>
                <li><strong>Datos de acceso:</strong> dirección de correo electrónico y contraseña cifrada para autenticación.</li>
                <li><strong>Datos de operación:</strong> registros de solicitudes quirúrgicas, programación de pabellones, consumo de insumos y registros de auditoría.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">3. Finalidad del tratamiento</h2>
              <p className="mb-3">Los datos son tratados con las siguientes finalidades:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Gestionar la programación quirúrgica de la clínica.</li>
                <li>Comunicar a los profesionales médicos el estado de sus solicitudes.</li>
                <li>Mantener un registro de auditoría para cumplimiento normativo.</li>
                <li>Controlar el inventario de insumos médicos.</li>
                <li>Generar reportes estadísticos de uso para la administración de la clínica.</li>
              </ul>
              <p className="mt-3">
                No utilizamos los datos para publicidad, no los vendemos a terceros ni los compartimos con otras organizaciones fuera del contexto del servicio contratado.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">4. Base legal del tratamiento</h2>
              <p>
                El tratamiento de datos se basa en el consentimiento del titular al registrarse en el sistema, y en la ejecución del contrato de prestación del servicio suscrito entre QuirúrgicaPro y la clínica cliente.
                Los datos de pacientes son tratados bajo la autorización explícita de la clínica, quien actúa como responsable de la relación con el paciente.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">5. Seguridad de los datos</h2>
              <p className="mb-3">Implementamos medidas técnicas y organizativas para proteger los datos:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Cifrado en tránsito mediante HTTPS/TLS.</li>
                <li>Cifrado en reposo en la base de datos.</li>
                <li>Contraseñas almacenadas con algoritmo bcrypt (nunca en texto plano).</li>
                <li>Acceso restringido por roles: el personal de pabellón y los médicos ven solo lo que corresponde a su función.</li>
                <li>Respaldos automáticos diarios con retención de 30 días.</li>
                <li>Registro de auditoría de todas las acciones realizadas en el sistema.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">6. Conservación de los datos</h2>
              <p>
                Los datos se conservan durante el período de vigencia del contrato de servicio con la clínica y por un período adicional de
                <strong> 5 años</strong> contados desde la terminación del contrato, conforme a los plazos de prescripción aplicables en Chile,
                salvo que la normativa específica del sector salud exija un plazo mayor.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">7. Derechos del titular</h2>
              <p className="mb-3">
                Conforme al artículo 12 de la Ley N° 19.628, el titular de datos personales tiene derecho a:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Acceso:</strong> conocer qué datos suyos están almacenados.</li>
                <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
                <li><strong>Cancelación:</strong> solicitar la eliminación de sus datos cuando ya no sean necesarios.</li>
                <li><strong>Oposición:</strong> oponerse al tratamiento de sus datos en determinados contextos.</li>
              </ul>
              <p className="mt-3">
                Para ejercer estos derechos, puede contactarnos a través del formulario de contacto o directamente con el administrador de la clínica.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">8. Proveedores de infraestructura</h2>
              <p>
                QuirúrgicaPro utiliza <strong>Supabase</strong> (PostgreSQL en la nube) para el almacenamiento de datos,
                con servidores ubicados en la región de São Paulo, Brasil (dentro de América del Sur).
                Supabase cumple con estándares internacionales de seguridad (SOC 2 Type II).
                Para despliegue web utilizamos <strong>Vercel</strong>, con nodos de distribución globales.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">9. Modificaciones a esta política</h2>
              <p>
                Nos reservamos el derecho de actualizar esta política para reflejar cambios en el servicio o en la normativa aplicable.
                En caso de cambios materiales, notificaremos a los usuarios registrados por correo electrónico con al menos 15 días de anticipación.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">10. Contacto</h2>
              <p>
                Si tiene consultas sobre esta política o desea ejercer sus derechos, contáctenos a través del{' '}
                <Link to="/contacto" className="text-blue-600 hover:underline font-medium">
                  formulario de contacto
                </Link>
                .
              </p>
            </section>

          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            </div>
            <span className="text-white font-bold text-sm">QuirúrgicaPro</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link to="/politica-privacidad" className="hover:text-slate-300 transition-colors">
              Política de privacidad
            </Link>
            <Link to="/contacto" className="hover:text-slate-300 transition-colors">
              Contacto
            </Link>
            <Link to="/acceso" className="hover:text-slate-300 transition-colors">
              Ingresar
            </Link>
          </div>
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} QuirúrgicaPro · Chile</p>
        </div>
      </footer>

    </div>
  )
}
