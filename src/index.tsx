/*!
 * Original code by Param Aggarwal
 * MIT Licensed, Copyright (c) 2018 Param Aggarwal, see
 * https://github.com/react-dropzone/react-dropzone/blob/master/LICENSE for details
 *
 * Credits to the Param Aggarwal:
 * - https://github.com/react-dropzone/react-dropzone/blob/master/src/index.js
 * - https://github.com/react-dropzone/react-dropzone/blob/master/src/utils/index.js
 */

import {
  ComponentProps,
  createEffect,
  createMemo,
  createSignal,
  mergeProps,
  onCleanup,
  splitProps,
  JSX,
  DEV,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { fromEvent } from 'file-selector'
import accepts from 'attr-accept'

export type ErrorCode =
  | 'file-invalid-type'
  | 'file-too-large'
  | 'file-too-small'
  | 'too-many-files'
  | (string & {})

export type FileError = {
  code: ErrorCode
  message: string
}

export type FileRejection = {
  file: File
  errors: FileError[]
}
export type DropEvent = InputEvent | DragEvent | Event

export type OnDropHandler = <T extends File>(
  acceptedFiles: T[],
  fileRejections: FileRejection[],
  event: DropEvent | null,
) => void

type RemoveBoundEventHandlers<TProps extends Record<string, any>> = {
  [Key in keyof TProps]: NonNullable<TProps[Key]> extends JSX.EventHandlerUnion<
    infer Element,
    infer Event
  >
    ? JSX.EventHandler<Element, Event>
    : TProps[Key]
}

export type DropzoneRootProps = RemoveBoundEventHandlers<ComponentProps<'div'>> & {
  refKey?: string
}
export type DropzoneInputProps = RemoveBoundEventHandlers<ComponentProps<'input'>> & {
  refKey?: string
}

export type CreateDropzoneProps = RemoveBoundEventHandlers<
  Pick<ComponentProps<'input'>, 'multiple' | 'onDragEnter' | 'onDragOver' | 'onDragLeave'>
> & {
  accept?: AcceptProp
  minSize?: number
  maxSize?: number
  maxFiles?: number
  preventDropOnDocument?: boolean
  noClick?: boolean
  noKeyboard?: boolean
  noDrag?: boolean
  noDragEventsBubbling?: boolean
  disabled?: boolean
  autoFocus?: boolean
  onDrop?: OnDropHandler
  getFilesFromEvent?: (event: DropEvent) => Promise<Array<File | DataTransferItem>>
  onFileDialogCancel?: () => void
  onFileDialogOpen?: () => void
  validator?: <T extends File>(file: T) => FileError | FileError[] | null
  useFsAccessApi?: boolean
  onError?: (error: unknown) => void
}
export type CreateDropzoneResult = ReturnType<typeof createDropzone>

type AcceptProp = string | string[]

const noop = () => {}

const getInitialState = () => ({
  isFocused: false,
  isFileDialogActive: false,
  isDragActive: false,
  isDragAccept: false,
  isDragReject: false,
  acceptedFiles: [] as File[],
  fileRejections: [] as FileRejection[],
})
export const createDropzone = (_props: CreateDropzoneProps) => {
  const props = mergeProps(
    {
      disabled: false,
      getFilesFromEvent: fromEvent,
      maxSize: Infinity,
      minSize: 0,
      multiple: true,
      maxFiles: 0,
      preventDropOnDocument: true,
      noClick: false,
      noKeyboard: false,
      noDrag: false,
      noDragEventsBubbling: false,
      validator: null,
      useFsAccessApi: true,
      autoFocus: false,
      accept: '',
    },
    _props,
  )

  const [state, setState] = createStore(getInitialState())

  const acceptAttr = createMemo(() => acceptPropAsAcceptAttr(props.accept))
  const pickerTypes = createMemo(() => pickerOptionsFromAccept(props.accept))

  const [rootRef, setRootRef] = createSignal<HTMLElement | null>()
  const [inputRef, setInputRef] = createSignal<HTMLInputElement | null>()

  let fsAccessApiWorks = typeof window !== 'undefined' && canUseFileSystemAccessAPI()

  const onWindowFocus = () => {
    if (!fsAccessApiWorks && state.isFileDialogActive) {
      setTimeout(() => {
        const input = inputRef()
        if (input) {
          const { files } = input

          if (!files?.length) {
            setState('isFileDialogActive', false)
            props.onFileDialogCancel?.()
          }
        }
      }, 300)
    }
  }

  createEffect(() => {
    window.addEventListener('focus', onWindowFocus, false)
    onCleanup(() => {
      window.removeEventListener('focus', onWindowFocus, false)
    })
  })

  let dragTargets: HTMLElement[] = []
  const onDocumentDrop = (event: DropEvent) => {
    const root = rootRef()
    if (root && root.contains(event.target as Node)) {
      // If we intercepted an event for our instance, let it propagate down to the instance's onDrop handler
      return
    }
    event.preventDefault()
    dragTargets = []
  }

  createEffect(() => {
    if (!props.preventDropOnDocument) {
      document.addEventListener('dragover', onDocumentDragOver, false)
      document.addEventListener('drop', onDocumentDrop, false)

      onCleanup(() => {
        document.removeEventListener('dragover', onDocumentDragOver, false)
        document.removeEventListener('drop', onDocumentDrop, false)
      })
    }
  })

  createEffect(() => {
    if (!props.disabled && props.autoFocus) {
      rootRef()?.focus()
    }
  })

  const onError = (error: any) => {
    if (props.onError) {
      props.onError(error)
    } else {
      if (DEV) {
        // Let the user know something's gone wrong if they haven't provided the onError cb.
        console.error(error)
      }
    }
  }

  const stopPropagation = (event: Event) => {
    if (props.noDragEventsBubbling) {
      event.stopPropagation()
    }
  }

  const onDragEnter = (event: DragEvent) => {
    event.preventDefault()
    stopPropagation(event)

    dragTargets = [...dragTargets, event.target as HTMLElement]

    if (isEvtWithFiles(event)) {
      Promise.resolve(props.getFilesFromEvent(event))
        .then(files => {
          if (isPropagationStopped(event) && !props.noDragEventsBubbling) {
            return
          }

          const fileCount = files.length
          const isDragAccept =
            fileCount > 0 &&
            allFilesAccepted({
              files: files
                .map(fileOrDataTransferItem =>
                  fileOrDataTransferItem instanceof File
                    ? fileOrDataTransferItem
                    : // `file-selector`
                      fileOrDataTransferItem.getAsFile(),
                )
                .filter(Boolean) as File[],
              accept: props.accept,
              minSize: props.minSize,
              maxSize: props.maxSize,
              multiple: props.multiple,
              maxFiles: props.maxFiles,
              validator: props.validator,
            })
          const isDragReject = fileCount > 0 && !isDragAccept

          setState({
            isDragAccept,
            isDragReject,
            isDragActive: true,
          })

          props.onDragEnter?.(event as any)
        })
        .catch(e => onError(e))
    }
  }

  const onDragOver = (event: DragEvent) => {
    event.preventDefault()
    stopPropagation(event)

    const hasFiles = isEvtWithFiles(event)
    if (hasFiles && event.dataTransfer) {
      try {
        event.dataTransfer.dropEffect = 'copy'
      } catch {} /* eslint-disable-line no-empty */
    }

    if (hasFiles) {
      props.onDragOver?.(event as any)
    }

    return false
  }

  const onDragLeave = (event: DragEvent) => {
    event.preventDefault()
    stopPropagation(event)

    const root = rootRef()
    // Only deactivate once the dropzone and all children have been left
    const targets = dragTargets.filter(target => root?.contains(target))
    // Make sure to remove a target present multiple times only once
    // (Firefox may fire dragenter/dragleave multiple times on the same element)
    const targetIdx = targets.indexOf(event.target as HTMLElement)
    if (targetIdx !== -1) {
      targets.splice(targetIdx, 1)
    }
    dragTargets = targets
    if (targets.length > 0) {
      return
    }

    setState({
      isDragActive: false,
      isDragAccept: false,
      isDragReject: false,
    })

    if (isEvtWithFiles(event)) {
      props.onDragLeave?.(event as any)
    }
  }

  const setFiles = (files: File[], event: Event | null) => {
    const acceptedFiles: File[] = []
    const fileRejections: FileRejection[] = []

    files.forEach(file => {
      const [accepted, acceptError] = fileAccepted(file, props.accept)
      const [sizeMatch, sizeError] = fileMatchSize(file, props.minSize, props.maxSize)
      const customErrors = props.validator ? props.validator(file) : null

      if (accepted && sizeMatch && !customErrors) {
        acceptedFiles.push(file)
      } else {
        let errors = [acceptError, sizeError]

        if (customErrors) {
          errors = errors.concat(customErrors)
        }

        fileRejections.push({
          file,
          errors: errors.filter(Boolean) as FileError[],
        })
      }
    })

    if (
      (!props.multiple && acceptedFiles.length > 1) ||
      (props.multiple && props.maxFiles >= 1 && acceptedFiles.length > props.maxFiles)
    ) {
      // Reject everything and empty accepted files
      acceptedFiles.forEach(file => {
        fileRejections.push({ file, errors: [getTooManyFilesRejectionErr()] })
      })
      acceptedFiles.splice(0)
    }

    setState({
      acceptedFiles,
      fileRejections,
    })

    props.onDrop?.(acceptedFiles, fileRejections, event)
  }

  const onDrop = (event: DropEvent) => {
    event.preventDefault()
    stopPropagation(event)

    dragTargets = []

    if (isEvtWithFiles(event)) {
      Promise.resolve(props.getFilesFromEvent(event))
        .then(files => {
          if (isPropagationStopped(event) && !props.noDragEventsBubbling) {
            return
          }
          setFiles(files as File[], event)
        })
        .catch(e => onError(e))
    }

    setState(getInitialState())
  }

  const openFileDialog = () => {
    // No point to use FS access APIs if context is not secure
    // https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts#feature_detection
    if (fsAccessApiWorks) {
      setState('isFileDialogActive', true)
      props.onFileDialogOpen?.()
      // https://developer.mozilla.org/en-US/docs/Web/API/window/showOpenFilePicker
      const opts: {
        multiple?: boolean
        types?: Array<{ description: string; accept: Record<string, string[]> }>
      } = {
        multiple: props.multiple,
        types: pickerTypes(),
      }
      ;(window as any)
        .showOpenFilePicker(opts)
        .then((handles: FileSystemHandle) => props.getFilesFromEvent(handles as any))
        .then((files: File[]) => {
          setFiles(files as File[], null)
          setState('isFileDialogActive', false)
        })
        .catch((e: unknown) => {
          // AbortError means the user canceled
          if (isAbort(e)) {
            props.onFileDialogCancel?.()
            setState('isFileDialogActive', false)
          } else if (isSecurityError(e)) {
            fsAccessApiWorks = false
            // CORS, so cannot use this API
            // Try using the input
            const input = inputRef()
            if (input) {
              input.value = null as any
              input.click()
            } else {
              onError(
                new Error(
                  'Cannot open the file picker because the https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API is not supported and no <input> was provided.',
                ),
              )
            }
          } else {
            onError(e)
          }
        })
      return
    }

    const input = inputRef()
    if (input) {
      setState('isFileDialogActive', true)
      props.onFileDialogOpen?.()
      input.value = null as any
      input.click()
    }
  }

  const onKeydown = (event: KeyboardEvent) => {
    // Ignore keyboard events bubbling up the DOM tree
    const root = rootRef()
    if (!root || !root.isEqualNode(event.target as Node)) {
      return
    }

    if (
      event.key === ' ' ||
      event.key === 'Enter' ||
      event.keyCode === 32 ||
      event.keyCode === 13
    ) {
      event.preventDefault()
      openFileDialog()
    }
  }

  const onFocus = () => setState('isFocused', true)
  const onBlur = () => setState('isFocused', false)
  const onClick = () => {
    if (props.noClick) {
      return
    }

    // In IE11/Edge the file-browser dialog is blocking, therefore, use setTimeout()
    // to ensure React can handle state changes
    // See: https://github.com/react-dropzone/react-dropzone/issues/450
    if (isIeOrEdge()) {
      setTimeout(openFileDialog, 0)
    } else {
      openFileDialog()
    }
  }

  const composeHandler = <TFunc extends Function>(fn: TFunc) => {
    return props.disabled ? noop : fn
  }

  const composeKeyboardHandler = <TFunc extends Function>(fn: TFunc) => {
    return props.noKeyboard ? noop : composeHandler(fn)
  }

  const composeDragHandler = <TFunc extends Function>(fn: TFunc) => {
    return props.noDrag ? noop : composeHandler(fn)
  }

  const getRootProps = (_overrides: DropzoneRootProps = {}): ComponentProps<'div'> => {
    const [overrides, rest] = splitProps(mergeProps({ refKey: 'ref' }, _overrides), [
      'onKeyDown',
      'onFocus',
      'onBlur',
      'onClick',
      'onDragEnter',
      'onDragOver',
      'onDragLeave',
      'onDrop',
      'role',
      'refKey',
    ])
    return {
      onKeyDown: composeKeyboardHandler(composeEventHandlers(overrides.onKeyDown, onKeydown)),
      onFocus: composeKeyboardHandler(composeEventHandlers(overrides.onFocus, onFocus)),
      onBlur: composeKeyboardHandler(composeEventHandlers(overrides.onBlur, onBlur)),
      onClick: composeHandler(composeEventHandlers(overrides.onClick, onClick)),
      onDragEnter: composeDragHandler(composeEventHandlers(overrides.onDragEnter, onDragEnter)),
      onDragOver: composeDragHandler(composeEventHandlers(overrides.onDragOver, onDragOver)),
      onDragLeave: composeDragHandler(composeEventHandlers(overrides.onDragLeave, onDragLeave)),
      onDrop: composeDragHandler(composeEventHandlers(overrides.onDrop, onDrop)),
      role: typeof overrides.role === 'string' && overrides.role ? overrides.role : 'presentation',
      [overrides.refKey]: setRootRef,
      ...(!props.disabled && !props.noKeyboard ? { tabIndex: 0 } : {}),
      ...rest,
    }
  }

  const onInputElementClick = (event: MouseEvent) => {
    event.stopPropagation()
  }

  const getInputProps = (_overrides: DropzoneInputProps = {}): ComponentProps<'input'> => {
    const [overrides, rest] = splitProps(mergeProps({ refKey: 'ref' }, _overrides), [
      'onChange',
      'onClick',
      'refKey',
    ])
    return {
      accept: acceptAttr(),
      multiple: props.multiple,
      type: 'file',
      style: { display: 'none' },
      onChange: composeHandler(composeEventHandlers(overrides.onChange, onDrop)),
      onClick: composeHandler(composeEventHandlers(overrides.onClick, onInputElementClick)),
      tabIndex: -1,
      [overrides.refKey]: setInputRef,
      ...rest,
    }
  }

  return mergeProps(state, {
    get isFocused() {
      return state.isFocused && !props.disabled
    },
    getInputProps,
    getRootProps,
    rootRef: setRootRef,
    inputRef: setInputRef,
    open: composeHandler(openFileDialog),
  })
}

// File Errors
const getInvalidTypeRejectionErr = (accept: AcceptProp): FileError => {
  accept = Array.isArray(accept) && accept.length === 1 ? accept[0]! : accept
  const messageSuffix = Array.isArray(accept) ? `one of ${accept.join(', ')}` : accept
  return {
    code: 'file-invalid-type',
    message: `File type must be ${messageSuffix}`,
  }
}

const getTooLargeRejectionErr = (maxSize: number): FileError => {
  return {
    code: 'file-too-large',
    message: `File is larger than ${maxSize} ${maxSize === 1 ? 'byte' : 'bytes'}`,
  }
}

const getTooSmallRejectionErr = (minSize: number): FileError => {
  return {
    code: 'file-too-small',
    message: `File is smaller than ${minSize} ${minSize === 1 ? 'byte' : 'bytes'}`,
  }
}

const getTooManyFilesRejectionErr = (): FileError => {
  return {
    code: 'too-many-files',
    message: 'Too many files',
  }
}

type FileErrorResult = [false, FileError] | [true, null]

// Firefox versions prior to 53 return a bogus MIME type for every file drag, so dragovers with
// that MIME type will always be accepted
function fileAccepted(file: File, accept: AcceptProp): FileErrorResult {
  const isAcceptable = file.type === 'application/x-moz-file' || accepts(file, accept)
  if (isAcceptable) return [true, null]
  return [false, getInvalidTypeRejectionErr(accept)]
}

function fileMatchSize(file: File, minSize?: number, maxSize?: number): FileErrorResult {
  if (isDefined(file.size)) {
    if (isDefined(minSize) && isDefined(maxSize)) {
      if (file.size > maxSize) return [false, getTooLargeRejectionErr(maxSize)]
      if (file.size < minSize) return [false, getTooSmallRejectionErr(minSize)]
    } else if (isDefined(minSize) && file.size < minSize)
      return [false, getTooSmallRejectionErr(minSize)]
    else if (isDefined(maxSize) && file.size > maxSize)
      return [false, getTooLargeRejectionErr(maxSize)]
  }
  return [true, null]
}

function isDefined<T>(value: T): value is NonNullable<T> {
  return value !== undefined && value !== null
}

function allFilesAccepted({
  files,
  accept,
  minSize,
  maxSize,
  multiple,
  maxFiles,
  validator,
}: {
  files: File[]
  accept: AcceptProp
  minSize: number
  maxSize: number
  multiple: boolean
  maxFiles: number
  validator: CreateDropzoneProps['validator'] | null
}) {
  if ((!multiple && files.length > 1) || (multiple && maxFiles >= 1 && files.length > maxFiles)) {
    return false
  }

  return files.every(file => {
    const [accepted] = fileAccepted(file, accept)
    const [sizeMatch] = fileMatchSize(file, minSize, maxSize)
    const customErrors = validator ? validator(file) : null
    return accepted && sizeMatch && !customErrors
  })
}

function isPropagationStopped(event: Event) {
  if (typeof event.cancelBubble !== 'undefined') {
    return event.cancelBubble
  }
  return false
}

function isEvtWithFiles(event: DragEvent | DropEvent) {
  if (!('dataTransfer' in event) || !event.dataTransfer) {
    return !!event.target && 'files' in event.target && !!(event.target as any).files
  }
  // https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/types
  // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#file
  return Array.prototype.some.call(
    event.dataTransfer.types,
    type => type === 'Files' || type === 'application/x-moz-file',
  )
}

// allow the entire document to be a drag target
function onDocumentDragOver(event: DragEvent) {
  event.preventDefault()
}

function isIe(userAgent: string) {
  return userAgent.indexOf('MSIE') !== -1 || userAgent.indexOf('Trident/') !== -1
}

function isEdge(userAgent: string) {
  return userAgent.indexOf('Edge/') !== -1
}

function isIeOrEdge(userAgent = window.navigator.userAgent) {
  return isIe(userAgent) || isEdge(userAgent)
}

/**
 * This is intended to be used to compose event handlers
 * They are executed in order until one of them calls `event.isPropagationStopped()`.
 * Note that the check is done on the first invoke too,
 * meaning that if propagation was stopped before invoking the fns,
 * no handlers will be executed.
 *
 * @param fns the event hanlder functions
 * @return the event handler to add to an element
 */
function composeEventHandlers<
  Arg0 extends any = any,
  Func extends (arg0: Arg0) => void = (arg0: Arg0) => void,
>(...fns: (Func | null | undefined)[]): Func {
  return ((event: any) => {
    fns.some(fn => {
      if (!isPropagationStopped(event) && fn) {
        fn(event)
      }
      return isPropagationStopped(event)
    })
  }) as Func
}

/**
 * canUseFileSystemAccessAPI checks if the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
 * is supported by the browser.
 * @returns
 */
function canUseFileSystemAccessAPI(): boolean {
  return 'showOpenFilePicker' in window
}

function pickerOptionsFromAccept(accept: AcceptProp | undefined) {
  if (isDefined(accept)) {
    const acceptForPicker = Object.entries(accept)
      .filter(([mimeType, ext]) => {
        let ok = true

        if (!isMIMEType(mimeType)) {
          console.warn(
            `Skipped "${mimeType}" because it is not a valid MIME type. Check https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types for a list of valid MIME types.`,
          )
          ok = false
        }

        if (!Array.isArray(ext) || !ext.every(isExt)) {
          console.warn(`Skipped "${mimeType}" because an invalid file extension was provided.`)
          ok = false
        }

        return ok
      })
      .reduce(
        (agg, [mimeType, ext]) => ({
          ...agg,
          [mimeType]: ext,
        }),
        {},
      )
    return [
      {
        // description is required due to https://crbug.com/1264708
        description: 'Files',
        accept: acceptForPicker,
      },
    ]
  }
  return accept
}

/**
 * Convert the `{accept}` dropzone prop to an array of MIME types/extensions.
 * @param accept
 * @returns
 */
function acceptPropAsAcceptAttr(accept: AcceptProp | undefined): string | undefined {
  if (isDefined(accept)) {
    return (
      Object.entries(accept)
        .reduce((a, [mimeType, ext]) => [...a, mimeType, ...ext], [] as string[])
        // Silently discard invalid entries as pickerOptionsFromAccept warns about these
        .filter(v => isMIMEType(v) || isExt(v))
        .join(',')
    )
  }

  return undefined
}

/**
 * Check if v is an exception caused by aborting a request (e.g window.showOpenFilePicker()).
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/DOMException.
 * @param v
 * @returns True if v is an abort exception.
 */
function isAbort(v: unknown): v is DOMException {
  return v instanceof DOMException && (v.name === 'AbortError' || v.code === v.ABORT_ERR)
}

/**
 * Check if v is a security error.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/DOMException.
 * @param v
 * @returns True if v is a security error.
 */
function isSecurityError(v: unknown): v is DOMException {
  return v instanceof DOMException && (v.name === 'SecurityError' || v.code === v.SECURITY_ERR)
}

/**
 * Check if v is a MIME type string.
 *
 * See accepted format: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#unique_file_type_specifiers.
 *
 * @param v
 */
function isMIMEType(v: string) {
  return (
    v === 'audio/*' ||
    v === 'video/*' ||
    v === 'image/*' ||
    v === 'text/*' ||
    /\w+\/[-+.\w]+/g.test(v)
  )
}

/**
 * Check if v is a file extension.
 * @param v
 */
function isExt(v: string) {
  return /^.*\.[\w]+$/.test(v)
}
