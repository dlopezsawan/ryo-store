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
    title: "3. Con Quien Compartimos tus Datos",
    content: `Enrola Shop NO vende, alquila ni comercia tus datos personales con terceros para fines de marketing. Compartimos unicamente la informacion minima necesaria con los siguientes proveedores tecnologicos y operativos para poder ejecutar la compra y operar el servicio:\n\nLOGISTICA\n- MRW (Venezuela): empresa de mensajeria que recibe nombre, cedula, telefono y direccion para entregar tu pedido.\n\nCOMUNICACIONES\n- Resend (Estados Unidos): proveedor de correo electronico transaccional. Recibe tu correo y el contenido del email enviado (notificaciones de pedido, recuperacion de contrasena, etc.).\n- Listmonk (autohospedado en Venezuela): plataforma de newsletter. Solo procesa tu correo si te suscribiste voluntariamente.\n- WhatsApp / WaSenderAPI: para notificaciones y conversacion con nuestro equipo de atencion al cliente y con Dana (ver Seccion 9).\n\nINTELIGENCIA ARTIFICIAL\n- DeepSeek (Republica Popular China): procesa los mensajes que el Cliente envia a Dana (asistente conversacional automatico). El contenido de la conversacion se procesa en servidores en China; ver Seccion 9 para detalles y mitigaciones aplicadas.\n\nSEGURIDAD ANTI-FRAUDE\n- Google reCAPTCHA (Estados Unidos): valida formularios para evitar bots. Al usar reCAPTCHA, Google captura informacion limitada de comportamiento del navegador (movimientos de mouse, IP). Mas informacion en politicas de Google.\n\nANALITICA\n- Google Analytics 4 (Estados Unidos): metricas agregadas de uso del Sitio.\n- Umami (autohospedado en Venezuela): metricas de paginas vistas sin cookies de rastreo.\n- PostHog (Estados Unidos): metricas de producto, embudos de conversion y telemetria de errores.\n\nALOJAMIENTO\n- Hostinger (Lituania / Estados Unidos): proveedor de servidor para el Sitio y los servicios internos.\n\nCUMPLIMIENTO LEGAL\n- SENIAT (Venezuela): cuando corresponde, datos fiscales necesarios para emision de factura.\n- Autoridades venezolanas: si fueramos requeridos por orden judicial competente.\n\nLas analiticas (GA4, PostHog, Umami) y las cookies de rastreo NO se cargan hasta que el visitante haya pasado el control de edad. Los datos se transmiten cifrados (HTTPS) y los proveedores estan obligados contractualmente a no usar la informacion para fines distintos al servicio acordado.`,
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
    title: "8. Plazos de Conservacion",
    content: `Conservamos tus datos solo el tiempo necesario para los fines descritos:\n\n- Datos contables y facturas: 5 a 10 anos (exigencia SENIAT).\n- Datos de cliente con cuenta activa: mientras dure la relacion comercial mas 2 anos.\n- Comprobantes de pago (Pago Movil, transferencias): 5 anos como prueba de operacion.\n- Conversaciones con Dana / WhatsApp: 6 meses, salvo caso comercial en curso.\n- Logs tecnicos del sitio (analitica, errores): 12 meses.\n\nVencidos los plazos, los datos se eliminan o se anonimizan (se conservan registros agregados para analisis sin posibilidad de reidentificar al titular).`,
  },
  {
    title: "9. Asistente automatico (Dana) y transferencia internacional",
    content: `Dana es nuestro asistente conversacional automatico, impulsado por inteligencia artificial. Las consultas que el Cliente envia a Dana se procesan a traves de DeepSeek, proveedor de IA con sede en la Republica Popular China.\n\nIMPLICACIONES:\n- Las conversaciones viajan a servidores de DeepSeek en China para generar la respuesta.\n- DeepSeek puede conservar logs de las consultas conforme a su politica interna.\n- Esta transferencia constituye una transferencia internacional de datos a una jurisdiccion distinta a Venezuela.\n\nMEDIDAS DE MITIGACION QUE APLICAMOS:\n- Antes de enviar mensajes a DeepSeek, sanitizamos automaticamente patrones que parecen cedula, numero de telefono y correo electronico, reemplazandolos por marcadores genericos.\n- No enviamos informacion sensible adicional (lista de clientes, costos internos) en el contexto del modelo.\n- El Cliente puede en cualquier momento escribir AGENTE para terminar la sesion automatica y ser atendido por una persona del equipo.\n\nAl utilizar Dana, el Cliente declara estar informado y aceptar esta transferencia internacional. Si prefieres no utilizar Dana, puedes contactarnos directamente por correo o WhatsApp con un humano.`,
  },
  {
    title: "10. Verificacion de Edad",
    content: `Al ingresar al Sitio, se solicita declaracion expresa de mayoria de edad (control de edad obligatorio para productos de tabaco). Cada aceptacion del control de edad queda registrada con fecha, hora, direccion IP, navegador y la version exacta del aviso aceptado, conforme exige la legislacion venezolana sobre validez de la aceptacion electronica.\n\nLas analiticas y herramientas de medicion no se activan hasta despues de superar este control, para evitar la captura de datos de eventuales menores.`,
  },
  {
    title: "11. Tus Derechos (Habeas Data)",
    content: `Conforme al articulo 28 de la Constitucion de la Republica Bolivariana de Venezuela (Habeas Data), tienes derecho a:\n\n- ACCEDER a la informacion personal que Enrola Shop tiene sobre ti.\n- RECTIFICAR datos incorrectos o desactualizados.\n- SOLICITAR LA DESTRUCCION de los datos que ya no sean necesarios para los fines declarados (excepcion: datos contables que debemos conservar por exigencia SENIAT).\n- CONOCER LA FINALIDAD especifica del uso de cada categoria de dato.\n- REVOCAR el consentimiento para comunicaciones de marketing (newsletter).\n\nCanal dedicado para solicitudes Habeas Data: privacidad@enrola.shop\n(en su defecto: hola@enrola.shop con asunto "Solicitud Habeas Data")\n\nPlazo de respuesta: maximo 15 dias habiles. Para procesar la solicitud verificaremos previamente tu identidad (foto de cedula vs. cedula registrada). Cada solicitud queda registrada con un identificador unico para trazabilidad.`,
  },
  {
    title: "12. Modificaciones de esta Politica",
    content: `Enrola Shop puede actualizar esta Politica de Privacidad cuando cambien las practicas, los proveedores tecnologicos o la normativa aplicable. Cuando un cambio sea material, lo anunciaremos mediante banner visible en el Sitio y, para clientes registrados, por correo electronico, con al menos 15 dias de preaviso antes de su entrada en vigor. La fecha de la ultima actualizacion siempre estara visible al inicio de esta pagina.`,
  },
  {
    title: "13. Contacto",
    content: `Para cualquier consulta sobre tu privacidad o tus datos personales:\n\n- Habeas Data y privacidad: privacidad@enrola.shop\n- Soporte general: hola@enrola.shop\n- Instagram: @ryo.smoke\n\nResponderemos a tu solicitud en los plazos indicados (maximo 15 dias habiles para Habeas Data; 5 dias para consultas generales).`,
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
          Ultima actualizacion: Mayo 2026. En Enrola Shop nos tomamos en serio
          la proteccion de tu informacion personal. Si despues de leer esta
          politica tienes dudas sobre como usamos tus datos, escribenos a{" "}
          <a href="mailto:privacidad@enrola.shop" className="underline hover:text-primary">
            privacidad@enrola.shop
          </a>
          .
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
