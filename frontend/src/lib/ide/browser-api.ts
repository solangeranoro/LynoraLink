'use client'

export interface LynoraBrowserAPI {
  getURL: () => string | null
  navigate: (url: string) => void
  goBack: () => void
  goForward: () => void
  reload: () => void
  getHTML: () => Promise<string>
  executeJavaScript: (script: string) => Promise<unknown>
}

type BrowserAction = 'get-html' | 'execute-javascript'

export interface BrowserController extends LynoraBrowserAPI {}

let browserController: BrowserController | null = null

export function setBrowserController(controller: BrowserController | null) {
  browserController = controller
}

export function getBrowserController() {
  return browserController
}

/** Pages may opt into content access by answering this request through postMessage. */
export function requestBrowserContent(
  frame: HTMLIFrameElement | null,
  action: BrowserAction,
  script?: string,
): Promise<unknown> {
  const target = frame?.contentWindow
  if (!target) {
    return Promise.reject(new Error('The Browser has no active page.'))
  }
  if (action === 'execute-javascript' && (!script || script.length > 20_000)) {
    return Promise.reject(new Error('JavaScript must contain between 1 and 20,000 characters.'))
  }

  const requestId = crypto.randomUUID()
  return new Promise<unknown>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new Error('The page did not respond to the Lynora browser bridge.'))
    }, 5_000)

    const onMessage = (event: MessageEvent) => {
      if (event.source !== target || !event.data || event.data.type !== 'lynora:browser:response'
        || event.data.id !== requestId) return

      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      if (typeof event.data.error === 'string') {
        reject(new Error(event.data.error))
      } else {
        resolve(event.data.result)
      }
    }

    window.addEventListener('message', onMessage)
    // Sandboxed pages have an opaque origin, so the exact target origin cannot be specified.
    target.postMessage({
      type: 'lynora:browser:request',
      id: requestId,
      action,
      ...(script === undefined ? {} : { script }),
    }, '*')
  })
}
