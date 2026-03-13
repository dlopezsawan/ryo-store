# Checkout y Pago Móvil

## Flujo

1. El cliente llega a `/checkout` desde el carrito
2. Completa el formulario de envío (email, nombre, dirección, teléfono)
3. Lee las instrucciones de Pago Móvil
4. Sube la captura del pago (JPG o PNG, máx. 5MB)
5. Al enviar, se completa el pedido en Medusa

## Datos de Pago Móvil mostrados

- **Banco:** Banco de Venezuela  
- **Cédula:** 21028734  
- **Teléfono:** 04244043276  

## Imagen del comprobante en Medusa

La captura se sube a `storefront/public/uploads/payment-proofs/` y la URL se guarda en:

- **Cart metadata** (`payment_proof_url`)
- **Payment session data** (`data.payment_proof_url`)

En Medusa Admin, el comprobante se puede ver en los detalles del pago del pedido. La URL está en los datos de la sesión de pago.

## Producción

Para producción (ej. Vercel), los archivos en `public/` no son persistentes. Opciones:

1. Usar **Vercel Blob** o **S3** para almacenar las imágenes
2. Modificar `/api/checkout/upload-proof` para subir a ese storage
3. Devolver la URL pública del archivo subido
