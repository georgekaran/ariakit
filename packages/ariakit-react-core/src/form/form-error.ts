import { useCallback, useRef } from "react";
import type { StringLike } from "@ariakit/core/form/types";
import { invariant } from "@ariakit/core/utils/misc";
import type { CollectionItemOptions } from "../collection/collection-item.js";
import { useCollectionItem } from "../collection/collection-item.js";
import { useId, useMergeRefs } from "../utils/hooks.js";
import {
  createElement,
  createHook,
  createMemoComponent,
} from "../utils/system.js";
import type { As, Props } from "../utils/types.js";
import { useFormContext } from "./form-context.js";
import type { FormStore } from "./form-store.js";

/**
 * Returns props to create a `FormDescription` component.
 * @see https://ariakit.org/components/form
 * @example
 * ```jsx
 * const store = useFormStore({ defaultValues: { email: "" } });
 * const props = useFormError({ store, name: store.names.email });
 *
 * store.useValidate(() => {
 *   if (!store.getValue(store.names.email)) {
 *     store.setError(store.names.email, "Email is required!");
 *   }
 * });
 *
 * <Form store={store}>
 *   <FormLabel name={store.names.email}>Email</FormLabel>
 *   <FormInput name={store.names.email} />
 *   <Role {...props} />
 * </Form>
 * ```
 */
export const useFormError = createHook<FormErrorOptions>(
  ({ store, name: nameProp, getItem: getItemProp, ...props }) => {
    const context = useFormContext();
    store = store || context;

    invariant(
      store,
      process.env.NODE_ENV !== "production" &&
        "FormError must be wrapped in a Form component.",
    );

    const id = useId(props.id);
    const ref = useRef<HTMLInputElement>(null);
    const name = `${nameProp}`;

    const getItem = useCallback<NonNullable<CollectionItemOptions["getItem"]>>(
      (item) => {
        const nextItem = { ...item, id: id || item.id, name, type: "error" };
        if (getItemProp) {
          return getItemProp(nextItem);
        }
        return nextItem;
      },
      [id, name, getItemProp],
    );

    const children = store.useState(() => {
      const error = store?.getError(name);
      if (error == null) return;
      if (!store?.getFieldTouched(name)) return;
      return error;
    });

    props = {
      id,
      role: "alert",
      children,
      ...props,
      ref: useMergeRefs(ref, props.ref),
    };

    props = useCollectionItem({ store, ...props, getItem });

    return props;
  },
);

/**
 * Renders an element that shows an error message. The `children` will
 * automatically display the error message defined in the store.
 * @see https://ariakit.org/components/form
 * @example
 * ```jsx {16}
 * const form = useFormStore({
 *   defaultValues: {
 *     email: "",
 *   },
 * });
 *
 * form.useValidate(() => {
 *   if (!form.values.email) {
 *     form.setError(form.names.email, "Email is required!");
 *   }
 * });
 *
 * <Form store={form}>
 *   <FormLabel name={form.names.email}>Email</FormLabel>
 *   <FormInput name={form.names.email} />
 *   <FormError name={form.names.email} />
 * </Form>
 * ```
 */
export const FormError = createMemoComponent<FormErrorOptions>((props) => {
  const htmlProps = useFormError(props);
  return createElement("div", htmlProps);
});

if (process.env.NODE_ENV !== "production") {
  FormError.displayName = "FormError";
}

export interface FormErrorOptions<T extends As = "div">
  extends CollectionItemOptions<T> {
  /**
   * Object returned by the
   * [`useFormStore`](https://ariakit.org/reference/use-form-store) hook. If not
   * provided, the closest [`Form`](https://ariakit.org/reference/form) or
   * [`FormProvider`](https://ariakit.org/reference/form-provider) components'
   * context will be used.
   */
  store?: FormStore;
  /**
   * Name of the field associated with this error. This can either be a string
   * or a reference to a field name from the
   * [`names`](https://ariakit.org/reference/use-form-store#names) object in the
   * store, for type safety.
   * @example
   * ```jsx
   * <FormError name="password" />
   * ```
   */
  name: StringLike;
}

export type FormErrorProps<T extends As = "div"> = Props<FormErrorOptions<T>>;
