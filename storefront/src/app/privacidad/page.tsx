import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getPageMetadata } from "@/lib/seo";

export const metadata = getPageMetadata(
  "Politica de Privacidad",
  "Conoce como Enrola Shop protege tu informacion personal. No vendemos tus datos a terceros.",
  "/privacidad"
);

const sections = [
  {
    title: "1. Informacion que Recopilamos",
    content: `Al utilizar Enrola Shop, podemos recopilar la siguiente informacion:\n\n- Datos personales: Nombre completo, correo electronico, numero de telefono y direccion de envio proporcionados al realizar un pedido.\n- Datos de pago: Comprobante de Pago Movil (captura de pantalla). No almacenamos datos bancarios directos.\n- Datos de navegacion: Informacion basica sobre tu visita (paginas vistas, productos consultados) para mejorar la experiencia de compra.`,
  },
  {
    title: "2. Como Usamos tu Informacion",
    content: `Utilizamos tu informacion exclusivamente para:\n\n- Procesar y entregar tus pedidos correctamente.\n- Verificar pagos y comprobantes.\n- Enviarte actualizaciones sobre el estado de tu pedido por correo electronico.\n- Enviarte nuestro newsletter solo si te suscribiste voluntariamente.\n- Gestionar tu cuenta y programa de puntos de lealtad.\n- Mejorar nuestro sitio web y la experiencia de compra.`,
  },
  {
    title: "3. No Vendemos tus Datos",
    content: `Enrola Shop se compromete a nunca vender, alquilar o compartir tu informacion personal con terceros para fines de marketing. Solo compartimos datos con:\n\n- Servicios de envio (MRW) para la entrega de tus pedidos.\n- Proveedores de correo electronico para notificaciones de pedidos.\n\nEstos terceros solo reciben la informacion minima necesaria para cumplir su funcion.`,
  },
  {
    title: "4. Almacenamiento Seguro",
    content: `Tu informacion se almacena en servidores seguros con encriptacion. Implementamos medidas de seguridad tecnicas y organizativas para proteger tus datos personales contra acceso no autorizado, perdida o alteracion.`,
  },
  {
    title: "5. Uso de Cookies",
    content: `Utilizamos cookies esenciales para:\n\n- Mantener tu carrito de compras activo durante tu visita.\n- Gestionar tu sesion de usuario si tienes cuenta.\n- Recordar tus preferencias basicas.\n\nNo utilizamos cookies de rastreo publicitario de terceros.`,
  },
  {
    title: "6. Tus Derechos",
    content: `Tienes derecho a:\n\n- Solicitar acceso a los datos personales que tenemos sobre ti.\n- Pedir la correccion de datos incorrectos.\n- Solicitar la eliminacion de tu cuenta y datos asociados.\n- Darte de baja del newsletter en cualquier momento.\n\nPara ejercer cualquiera de estos derechos, contactanos por correo a hola@enrola.shop.`,
  },
  {
    title: "7. Menores de Edad",
    content: `Enrola Shop no recopila intencionalmente informacion de menores de 18 anos. Nuestro sitio y productos estan destinados exclusivamente a mayores de edad. Si descubrimos que hemos recopilado datos de un menor, los eliminaremos de inmediato.`,
  },
  {
    title: "8. Contacto",
    content: `Para cualquier consulta sobre tu privacidad o tus datos personales:\n\n- Email: hola@enrola.shop\n- Instagram: @ryo.smoke\n\nResponderemos a tu solicitud en un plazo maximo de 5 dias habiles.`,
  },
];

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main className="max-w-[1380px] mx-auto px-4 py-8 md:py-12">
        {/* Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-1 w-12 bg-primary" />
          <h1 className="font-black text-dark text-3xl md:text-5xl uppercase tracking-tight">
            Politica de Privacidad
          </h1>
        </div>

        <p className="text-muted text-sm mb-8 max-w-2xl">
          Ultima actualizacion: Marzo 2026. En Enrola Shop nos tomamos en serio la
          proteccion de tu informacion personal.
        </p>

        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <section
              key={section.title}
              className="border-2 border-dark bg-white p-5 md:p-7"
              style={{ boxShadow: "4px 4px 0px 0px var(--secondary)" }}
            >
              <h2 className="font-black text-dark text-lg md:text-xl uppercase tracking-tight mb-3">
                {section.title}
              </h2>
              <div className="text-dark/80 text-sm md:text-base leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </section>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
