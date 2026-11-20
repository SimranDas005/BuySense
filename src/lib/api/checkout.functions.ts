import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { addressSchema } from "../address";
import { prepareOrderItems } from "./checkout-core";

const checkoutSchema = z.object({
  accessToken: z.string().min(20).max(8192),
  address: addressSchema,
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(200),
        quantity: z.number().int().positive().safe(),
      }),
    )
    .min(1)
    .max(42),
});

export const placeCodOrder = createServerFn({ method: "POST" })
  .validator(checkoutSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(
      data.accessToken,
    );
    if (authError || !authData.user) {
      throw new Error("Your session is invalid. Please sign in again.");
    }

    const { data: roles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id);
    if (roleError) {
      throw new Error(`Could not verify the customer account: ${roleError.message}`);
    }
    if (
      !roles?.some((role) => role.role === "customer") ||
      roles.some((role) => role.role === "admin")
    ) {
      throw new Error("Checkout is available to customer accounts only.");
    }

    const { data: cartRows, error: cartError } = await supabaseAdmin
      .from("cart_items")
      .select("id, product_id, product_slug, quantity")
      .eq("user_id", authData.user.id);
    if (cartError) {
      throw new Error(`Could not load your bag: ${cartError.message}`);
    }
    if (!cartRows?.length) throw new Error("Your bag is empty.");

    const { data: productRows, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, slug, model, brand, image_url, price, stock, is_active");
    if (productsError) {
      throw new Error(`Could not verify catalogue products: ${productsError.message}`);
    }

    const preparedItems = prepareOrderItems(cartRows, data.items, productRows ?? []);
    const subtotal = preparedItems.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0,
    );
    if (!Number.isSafeInteger(subtotal) || subtotal <= 0) {
      throw new Error("The order total is invalid.");
    }

    const now = new Date();
    const orderId = crypto.randomUUID();
    const orderNumber = `BS-${now.toISOString().slice(2, 10).replaceAll("-", "")}-${crypto
      .randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;
    const addressSnapshot = JSON.stringify({
      version: 1,
      address: data.address,
      customerEmail: authData.user.email ?? "",
    });

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        id: orderId,
        order_number: orderNumber,
        user_id: authData.user.id,
        order_status: "Pending",
        payment_status: "Pending",
        payment_method: "cod",
        subtotal,
        discount: 0,
        delivery_fee: 0,
        total_amount: subtotal,
        address: addressSnapshot,
        phone: data.address.phone,
      })
      .select("*")
      .single();
    if (orderError) {
      throw new Error(`Could not create your order: ${orderError.message}`);
    }

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
      preparedItems.map((item) => ({
        order_id: orderId,
        product_id: item.databaseProductId,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
      })),
    );
    if (itemsError) {
      const { data: rolledBackOrder, error: rollbackError } = await supabaseAdmin
        .from("orders")
        .delete()
        .eq("id", orderId)
        .select("id");
      if (rollbackError || !rolledBackOrder?.length) {
        console.error("[COD checkout] Order item insert failed and order cleanup also failed", {
          orderId,
          itemError: itemsError.message,
          rollbackError: rollbackError?.message ?? "The created order was not found for cleanup.",
        });
        throw new Error("Order items could not be saved and the incomplete order needs review.");
      }
      throw new Error(`Could not save your order items: ${itemsError.message}`);
    }

    let cartCleared = true;
    for (const row of cartRows) {
      let deleteQuery = supabaseAdmin
        .from("cart_items")
        .delete()
        .eq("user_id", authData.user.id)
        .eq("id", row.id)
        .eq("quantity", row.quantity);
      deleteQuery = row.product_id
        ? deleteQuery.eq("product_id", row.product_id).is("product_slug", null)
        : deleteQuery.is("product_id", null).eq("product_slug", row.product_slug);
      const { data: deleted, error: deleteError } = await deleteQuery.select("id");
      if (deleteError || deleted?.length !== 1) {
        cartCleared = false;
        console.error("[COD checkout] A processed cart row was not cleared", {
          orderId,
          cartRowId: row.id,
          error: deleteError?.message ?? "The cart row changed after checkout started.",
        });
      }
    }
    if (!cartCleared) {
      console.error("[COD checkout] Order was created but the processed cart rows remain", {
        orderId,
      });
    }

    return {
      order,
      items: preparedItems,
      address: data.address,
      customerEmail: authData.user.email ?? "",
      cartCleared,
    };
  });
