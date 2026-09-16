/**
 * The current workspace UI language for non-React code — toasts in store/domain code, helpers called
 * from event handlers: `translate(m, getUiLang(), "saved")`.
 *
 * Reads the data store directly (`@/lib/store/data-store`, not the `@/lib/store` barrel), so store
 * modules such as `domain.ts` can import it without a cycle. The one exception is `data-store.ts`
 * itself: it uses `uiLangOf(get().db.app_settings[0])` from `./core` instead of importing this file.
 */
import { useDataStore } from "@/lib/store/data-store"
import { uiLangOf, type UiLang } from "./core"

/** `app_settings.ui_language` of the loaded workspace; `"en"` before the workspace has loaded. */
export function getUiLang(): UiLang {
  return uiLangOf(useDataStore.getState().db.app_settings[0])
}
