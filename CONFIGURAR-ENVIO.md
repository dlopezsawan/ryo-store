# Configurar envío para Venezuela

**Si ves:** *"No hay opciones de envío para tu dirección"* o *"Providers are not enabled for the service location"*:

Haz la configuración **manualmente** en Medusa Admin (el script automático falla por restricciones de Medusa).

## Paso 1: Vincular el proveedor Manual a la ubicación

1. Inicia el backend: `cd backend && npm run dev`
2. Abre **Medusa Admin**: http://localhost:9000/app
3. Inicia sesión
4. Ve a **Settings** (Ajustes) → **Stock Locations** (Ubicaciones)
5. Haz clic en tu ubicación (**Valencia**)
6. En la sección **Fulfillment Providers**, haz clic en **Edit**
7. Activa el proveedor **Manual** (manual_manual)
8. **Guarda**

## Paso 2: Crear las opciones de envío

1. En la misma página, busca **Service Zones**
2. Abre la zona **Venezuela** (o la que tenga Venezuela en Geo Zones)
3. En **Shipping Options**, haz clic en **Add option**
4. Crea estas opciones:

   | Nombre | Precio | Código |
   |--------|--------|--------|
   | Inmediato (Valencia) - Gratis | $0 | inmediato_gratis |
   | Inmediato (Valencia) - $3 | $3 | inmediato_3 |
   | MRW - Cobro a destino | $0 | mrw |

5. Para cada una: tipo **Flat**, proveedor **Manual**, región **Venezuela**

## Paso 3: Si no existe la zona Venezuela

- Edita la zona **Europe** y añade el país **Venezuela (VE)** en Geo Zones, **o**
- Crea una nueva Service Zone "Venezuela" con país VE

## Paso 4: Región Venezuela y carrito nuevo

1. Si no tienes región Venezuela: `cd backend && npm run setup-venezuela`
2. **Vacía el carrito**: en checkout, clic en "Vaciar carrito e iniciar de nuevo"
3. Vuelve a la tienda, añade productos, y repite el checkout

---

Después de configurar, prueba el checkout de nuevo. Las opciones de envío deberían aparecer para direcciones en Venezuela.
