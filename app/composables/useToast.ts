import { toast as sonnerToast } from 'vue-sonner';
import type { Component } from 'vue';

type ToastVariant = 'success' | 'info' | 'warning' | 'error' | 'loading' | 'default';

interface ToastOptions {
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
  icon?: Component;
}

interface ErrorToastOptions extends ToastOptions {
  /** Optional structured code surfaced from the API (e.g. AUTH_NOT_ADMIN). */
  code?: string;
}

/**
 * App-wide toast helper backed by vue-sonner / shadcn Sonner.
 *
 * Use for short-lived notifications: form save confirmations, async errors,
 * background updates. The <Toaster /> is mounted once in `app.vue`.
 */
export function useToast() {
  function show(variant: ToastVariant, message: string, options: ToastOptions = {}) {
    const fn =
      variant === 'success'
        ? sonnerToast.success
        : variant === 'info'
          ? sonnerToast.info
          : variant === 'warning'
            ? sonnerToast.warning
            : variant === 'error'
              ? sonnerToast.error
              : variant === 'loading'
                ? sonnerToast.loading
                : sonnerToast;

    return fn(message, {
      description: options.description,
      duration: options.duration,
      action: options.action,
      icon: options.icon,
    });
  }

  return {
    success: (msg: string, opts?: ToastOptions) => show('success', msg, opts),
    info: (msg: string, opts?: ToastOptions) => show('info', msg, opts),
    warning: (msg: string, opts?: ToastOptions) => show('warning', msg, opts),
    error: (msg: string, opts?: ErrorToastOptions) => {
      const description =
        opts?.code && opts.description
          ? `[${opts.code}] ${opts.description}`
          : opts?.code
            ? `[${opts.code}]`
            : opts?.description;
      return show('error', msg, { ...opts, description });
    },
    loading: (msg: string, opts?: ToastOptions) => show('loading', msg, opts),
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
    /** Raw sonner instance for advanced usage (promise toasts, custom components). */
    raw: sonnerToast,
  };
}
