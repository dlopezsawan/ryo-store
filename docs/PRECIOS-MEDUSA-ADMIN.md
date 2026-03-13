# Precios en Medusa Admin

## Opción por defecto (PRICE_DIVISOR=100)

Medusa almacena importes en **centavos**. La tienda divide entre 100 para mostrar.

- En Medusa Admin introduce **1500** para $15.00
- La web muestra **$15**

## Precios 1:1 (PRICE_DIVISOR=1)

Si quieres introducir **15** en Medusa y ver **$15** en la web:

1. Añade en el `.env` del storefront (y en docker-compose):

   ```
   NEXT_PUBLIC_PRICE_DIVISOR=1
   ```

2. En Medusa Admin introduce los precios como unidades (15 para $15, 3 para $3).

**Importante:** Si cambias a PRICE_DIVISOR=1, tendrás que actualizar los precios de todos los productos en Medusa (multiplicar por 100 los existentes si antes usabas centavos, o introducirlos de nuevo).
