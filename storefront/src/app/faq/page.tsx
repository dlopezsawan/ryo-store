import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { getPageMetadata } from "@/lib/seo";

export const metadata = getPageMetadata(
  "Preguntas Frecuentes",
  "Resuelve tus dudas sobre pedidos, envios, pagos, devoluciones y mas en Enrola Shop.",
  "/faq"
);

type FaqCategory = {
  category: string;
  questions: { q: string; a: string | React.ReactNode }[];
};

const faqs: FaqCategory[] = [
  {
    category: "Pedidos y Pagos",
    questions: [
      {
        q: "Como hago un pedido?",
        a: "Navega por nuestra tienda, agrega los productos al carrito y ve al checkout. Completa tus datos de envio, selecciona tu metodo de envio y realiza el Pago Movil. Sube la captura del comprobante y listo, nosotros nos encargamos del resto.",
      },
      {
        q: "Que metodos de pago aceptan?",
        a: "Actualmente aceptamos Pago Movil (Banco de Venezuela). Proximamente habilitaremos metodos de pago internacionales como Zelle y PayPal.",
      },
      {
        q: "Cuanto tarda en verificarse mi pago?",
        a: "Verificamos los pagos lo mas rapido posible, generalmente en menos de 1 hora durante horario laboral (9am - 7pm). Recibiras un correo de confirmacion cuando tu pedido sea procesado.",
      },
      {
        q: "Puedo cancelar mi pedido?",
        a: "Si tu pedido aun no ha sido enviado, contactanos de inmediato por Instagram (@ryo.smoke) o email (hola@enrola.shop) y haremos lo posible por cancelarlo. Una vez despachado, se aplica nuestra politica de devoluciones.",
      },
    ],
  },
  {
    category: "Envios y Entregas",
    questions: [
      {
        q: "Cuales son las opciones de envio?",
        a: "Ofrecemos dos opciones: Envio Inmediato en Valencia (mismo dia o siguiente) y Envio Nacional via MRW para todo Venezuela.",
      },
      {
        q: "Cuanto cuesta el envio?",
        a: "El Envio Inmediato en Valencia es gratis en pedidos mayores a $10 (de lo contrario cuesta $3). El costo de envio MRW se calcula segun destino y peso al momento del checkout.",
      },
      {
        q: "Cuanto tarda en llegar mi pedido?",
        a: "Envio Inmediato Valencia: mismo dia o al dia siguiente. Envio Nacional MRW: generalmente entre 2 y 5 dias habiles, dependiendo de tu ubicacion y las condiciones del servicio de MRW.",
      },
      {
        q: "Como puedo rastrear mi pedido?",
        a: "Para envios MRW, te enviaremos el numero de guia por correo electronico una vez despachado tu pedido. Puedes rastrear tu envio directamente en la pagina de MRW.",
      },
    ],
  },
  {
    category: "Productos",
    questions: [
      {
        q: "Que tipo de productos venden?",
        a: "Vendemos accesorios para armar y fumar tabaco: papeles de liar (sedas), conos pre-armados, filtros, bandejas, grinders, encendedores y combos especiales. Todo para que tu experiencia Enrola sea la mejor.",
      },
      {
        q: "Cual es el mejor papel para principiantes?",
        a: "Recomendamos empezar con papeles tamano 1 1/4 (uno y cuarto), que son los mas faciles de manejar. Las marcas RAW y Elements son excelentes opciones para comenzar. Si prefieres algo mas facil, prueba nuestros conos pre-armados.",
      },
      {
        q: "Que tamano de conos tienen?",
        a: "Tenemos conos en varios tamanos: 1 1/4 (tamano estandar, ideal para uso personal), King Size (mas grandes, para compartir) y Mini (para una fumada rapida). Consulta la descripcion de cada producto para detalles especificos.",
      },
      {
        q: "Los productos son originales?",
        a: "Si, todos nuestros productos son 100% originales y los adquirimos directamente de distribuidores autorizados. Garantizamos la autenticidad de cada articulo.",
      },
    ],
  },
  {
    category: "Devoluciones y Garantia",
    questions: [
      {
        q: "Puedo devolver un producto?",
        a: 'Si, bajo nuestra "Garantia de Primera Liada". Si el producto llego danado, defectuoso o no coincide con tu pedido, te lo reemplazamos. Tienes 7 dias para reportar el problema.',
      },
      {
        q: "Como solicito una devolucion?",
        a: "Contactanos por email (hola@enrola.shop) o Instagram (@ryo.smoke) con tu numero de pedido, descripcion del problema y fotos del producto. Respondemos en 24-48 horas.",
      },
      {
        q: "Puedo devolver un producto abierto?",
        a: "Por razones de higiene, no aceptamos devoluciones de productos que hayan sido abiertos o usados. Solo aplica para productos sellados con defectos de fabrica o danos en el envio.",
      },
    ],
  },
  {
    category: "Programa de Lealtad",
    questions: [
      {
        q: "Como funciona el programa de puntos?",
        a: "Por cada compra acumulas puntos de lealtad automaticamente. Estos puntos los puedes canjear por productos gratis, descuentos y recompensas exclusivas desde tu cuenta.",
      },
      {
        q: "Como canjeo mis puntos?",
        a: "Inicia sesion en tu cuenta, ve a la seccion de recompensas y selecciona la que desees. Los puntos se descuentan automaticamente. Tambien puedes canjear recompensas directamente en el checkout.",
      },
      {
        q: "Los puntos expiran?",
        a: "Actualmente los puntos no tienen fecha de expiracion. Sin embargo, nos reservamos el derecho de modificar esta politica con aviso previo.",
      },
    ],
  },
  {
    category: "Cuenta y Verificacion",
    questions: [
      {
        q: "Necesito crear una cuenta para comprar?",
        a: "No es obligatorio, puedes comprar como invitado. Sin embargo, crear una cuenta te permite acumular puntos de lealtad, ver tu historial de pedidos y tener una experiencia mas rapida en futuras compras.",
      },
      {
        q: "Por que piden verificacion de edad?",
        a: "Nuestros productos son exclusivamente para mayores de 18 anos. Al realizar una compra, confirmas que cumples con este requisito. Es nuestra responsabilidad como tienda garantizar el cumplimiento de esta restriccion.",
      },
    ],
  },
];

// Build FAQPage structured data from the faqs array above (strings only; if a ReactNode
// answer is added later, it'll be skipped to keep schema valid).
const faqPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.flatMap((cat) =>
    cat.questions
      .filter((qa) => typeof qa.a === "string")
      .map((qa) => ({
        "@type": "Question",
        name: qa.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: qa.a as string,
        },
      }))
  ),
};

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd) }}
      />

      <main className="max-w-[1380px] mx-auto px-4 py-8 md:py-12">
        {/* Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-1 w-12 bg-primary" />
          <h1 className="font-black text-dark text-3xl md:text-5xl uppercase tracking-tight">
            Preguntas Frecuentes
          </h1>
        </div>

        <p className="text-muted text-sm mb-8 max-w-2xl">
          Encuentra respuestas a las preguntas mas comunes sobre Enrola Shop. Si
          no encuentras lo que buscas, no dudes en{" "}
          <Link href="/contacto" className="text-primary font-bold hover:underline">
            contactarnos
          </Link>
          .
        </p>

        <div className="flex flex-col gap-8">
          {faqs.map((category) => (
            <div key={category.category}>
              {/* Category header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-[3px] w-8 bg-orange" />
                <h2 className="font-black text-dark text-xl md:text-2xl uppercase tracking-tight">
                  {category.category}
                </h2>
              </div>

              <div className="flex flex-col gap-4">
                {category.questions.map((faq, i) => (
                  <details
                    key={i}
                    className="group border-2 border-dark bg-white"
                    style={{ boxShadow: "3px 3px 0px 0px var(--secondary)" }}
                  >
                    <summary className="cursor-pointer p-4 md:p-5 font-bold text-dark text-sm md:text-base uppercase tracking-wide flex items-center justify-between gap-4 select-none hover:bg-cream/50 transition-colors">
                      <span>{faq.q}</span>
                      <span className="text-primary font-black text-lg flex-shrink-0 transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <div className="px-4 pb-4 md:px-5 md:pb-5 border-t-2 border-dark/10 pt-3">
                      <p className="text-dark/80 text-sm md:text-base leading-relaxed">
                        {faq.a}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          className="mt-12 border-2 border-secondary bg-secondary/5 p-6 md:p-8 text-center"
          style={{ boxShadow: "4px 4px 0px 0px var(--secondary)" }}
        >
          <h2 className="font-black text-dark text-xl md:text-2xl uppercase tracking-tight mb-2">
            No encontraste tu respuesta?
          </h2>
          <p className="text-dark/70 text-sm md:text-base mb-4">
            Escribenos y te ayudamos de inmediato.
          </p>
          <Link
            href="/contacto"
            className="inline-block bg-primary text-white font-bold text-sm uppercase tracking-wider px-6 py-3 border-2 border-dark hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            style={{ boxShadow: "4px 4px 0px 0px var(--dark)" }}
          >
            Contactanos
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
