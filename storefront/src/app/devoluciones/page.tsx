import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getPageMetadata } from "@/lib/seo";

export const metadata = getPageMetadata(
  "Politica de Devoluciones",
  "Garantia de primera liada: si tu producto llego danado o defectuoso, te lo reemplazamos. Conoce nuestra politica de devoluciones.",
  "/devoluciones"
);

export default function DevolucionesPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main className="max-w-[1380px] mx-auto px-4 py-8 md:py-12">
        {/* Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-1 w-12 bg-primary" />
          <h1 className="font-black text-dark text-3xl md:text-5xl uppercase tracking-tight">
            Devoluciones
          </h1>
        </div>

        {/* Garantia highlight */}
        <div
          className="border-3 border-primary bg-primary/5 p-6 md:p-8 mb-8"
          style={{ boxShadow: "6px 6px 0px 0px var(--primary)", borderWidth: "3px" }}
        >
          <h2 className="font-black text-primary text-2xl md:text-3xl uppercase tracking-tight mb-2">
            Garantia de Primera Liada
          </h2>
          <p className="text-dark/80 text-base md:text-lg leading-relaxed">
            En Enrola Shop nos comprometemos con la calidad de cada producto que
            vendemos. Si tu pedido llego danado, defectuoso o no coincide con lo
            que ordenaste, te garantizamos un reemplazo sin costo adicional.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {/* Plazo */}
          <section
            className="border-2 border-dark bg-white p-5 md:p-7"
            style={{ boxShadow: "4px 4px 0px 0px var(--secondary)" }}
          >
            <h2 className="font-black text-dark text-lg md:text-xl uppercase tracking-tight mb-3">
              Plazo para Reportar
            </h2>
            <p className="text-dark/80 text-sm md:text-base leading-relaxed">
              Tienes <strong>7 dias calendario</strong> desde la fecha de
              recepcion de tu pedido para reportar cualquier problema con el
              producto. Despues de este plazo, no podremos procesar tu
              solicitud de devolucion o cambio.
            </p>
          </section>

          {/* Proceso */}
          <section
            className="border-2 border-dark bg-white p-5 md:p-7"
            style={{ boxShadow: "4px 4px 0px 0px var(--secondary)" }}
          >
            <h2 className="font-black text-dark text-lg md:text-xl uppercase tracking-tight mb-3">
              Como Solicitar una Devolucion
            </h2>
            <ol className="text-dark/80 text-sm md:text-base leading-relaxed space-y-3 list-decimal list-inside">
              <li>
                <strong>Contactanos</strong> por correo a{" "}
                <a href="mailto:hola@enrola.shop" className="text-primary font-bold hover:underline">
                  hola@enrola.shop
                </a>{" "}
                o por Instagram a{" "}
                <a
                  href="https://instagram.com/ryo.smoke"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-bold hover:underline"
                >
                  @ryo.smoke
                </a>
                .
              </li>
              <li>
                <strong>Incluye</strong> tu numero de pedido, una descripcion del
                problema y fotos del producto danado o defectuoso.
              </li>
              <li>
                <strong>Nuestro equipo</strong> revisara tu solicitud en un
                plazo de 24-48 horas y te indicara los pasos a seguir.
              </li>
              <li>
                <strong>Una vez aprobada</strong> la devolucion, coordinaremos
                el envio del producto de reemplazo.
              </li>
            </ol>
          </section>

          {/* Productos no retornables */}
          <section
            className="border-2 border-dark bg-white p-5 md:p-7"
            style={{ boxShadow: "4px 4px 0px 0px var(--secondary)" }}
          >
            <h2 className="font-black text-dark text-lg md:text-xl uppercase tracking-tight mb-3">
              Productos No Retornables
            </h2>
            <p className="text-dark/80 text-sm md:text-base leading-relaxed mb-3">
              Por razones de higiene y la naturaleza de nuestros productos, <strong>no aceptamos
              devoluciones</strong> en los siguientes casos:
            </p>
            <ul className="text-dark/80 text-sm md:text-base leading-relaxed space-y-2 list-disc list-inside">
              <li>Productos que hayan sido abiertos o usados.</li>
              <li>Productos danados por uso indebido o negligencia del comprador.</li>
              <li>Solicitudes realizadas fuera del plazo de 7 dias.</li>
              <li>Productos adquiridos en promociones donde se indique expresamente que no aplican devoluciones.</li>
            </ul>
          </section>

          {/* Costos de envio */}
          <section
            className="border-2 border-dark bg-white p-5 md:p-7"
            style={{ boxShadow: "4px 4px 0px 0px var(--secondary)" }}
          >
            <h2 className="font-black text-dark text-lg md:text-xl uppercase tracking-tight mb-3">
              Costos de Envio en Devoluciones
            </h2>
            <ul className="text-dark/80 text-sm md:text-base leading-relaxed space-y-2 list-disc list-inside">
              <li>
                <strong>Producto danado o defectuoso:</strong> Enrola Shop asume
                el costo del envio de reemplazo.
              </li>
              <li>
                <strong>Error en el pedido (nuestro error):</strong> Enrola Shop
                asume el costo total del envio.
              </li>
              <li>
                <strong>Cambio por preferencia del cliente:</strong> El cliente
                asume los costos de envio de ida y vuelta.
              </li>
            </ul>
          </section>

          {/* Contacto */}
          <section
            className="border-2 border-secondary bg-secondary/5 p-5 md:p-7"
            style={{ boxShadow: "4px 4px 0px 0px var(--secondary)" }}
          >
            <h2 className="font-black text-dark text-lg md:text-xl uppercase tracking-tight mb-3">
              Necesitas Ayuda?
            </h2>
            <p className="text-dark/80 text-sm md:text-base leading-relaxed">
              Si tienes alguna duda sobre nuestra politica de devoluciones, no
              dudes en escribirnos a{" "}
              <a href="mailto:hola@enrola.shop" className="text-primary font-bold hover:underline">
                hola@enrola.shop
              </a>{" "}
              o por Instagram a{" "}
              <a
                href="https://instagram.com/ryo.smoke"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-bold hover:underline"
              >
                @ryo.smoke
              </a>
              . Estamos para ayudarte.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
