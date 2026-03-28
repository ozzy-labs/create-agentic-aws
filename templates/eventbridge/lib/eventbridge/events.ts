/**
 * Event schema definitions for EventBridge.
 * Define your custom event types here.
 */

export interface AppEvent<T = unknown> {
  source: string;
  detailType: string;
  detail: T;
}

/** Example event: order created */
export interface OrderCreatedDetail {
  orderId: string;
  customerId: string;
  amount: number;
}

export const ORDER_CREATED: AppEvent<OrderCreatedDetail> = {
  source: "{{projectName}}.orders",
  detailType: "OrderCreated",
  detail: {
    orderId: "",
    customerId: "",
    amount: 0,
  },
};
