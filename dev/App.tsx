import { Component, splitProps, For, mergeProps, Show, ComponentProps } from 'solid-js'
import { createDropzone, CreateDropzoneProps, DropEvent, FileRejection } from '../src'

const Dropzone = (props: CreateDropzoneProps & { title: string }) => {
  const dropzone = createDropzone(
    mergeProps(props, {
      onDrop: (files: File[], rejections: FileRejection[], event: DropEvent | null) => {
        props.onDrop?.(files, rejections, event)
      },
    }),
  )

  const hasOutput = () => dropzone.acceptedFiles.length > 0 || dropzone.fileRejections.length > 0

  return (
    <div class="space-y-6">
      <h2 class="font-bold text-2xl">{props.title}</h2>
      <div
        {...dropzone.getRootProps({
          class: 'rounded-xl border-2 border-purple-700 min-h-[8rem] relative overflow-hidden',
        })}
      >
        <Show when={dropzone.isDragActive}>
          <div class="absolute inset-0 grid place-items-center bg-white">drop files here</div>
        </Show>

        <Show when={!hasOutput() && !dropzone.isDragActive}>
          <div class="absolute inset-0 grid place-items-center">click or drag files to upload</div>
        </Show>

        <Show when={hasOutput()}>
          <div class="grid gap-1 p-4 grid-cols-2">
            <div>
              <p class="font-bold text-lg">Accepted Files</p>
              <ul class="list-disc pl-4">
                <For each={dropzone.acceptedFiles} fallback={<li>No files accepted :(</li>}>
                  {file => <li>{file.name}</li>}
                </For>
              </ul>
            </div>
            <div>
              <p class="font-bold text-lg">Rejected Files</p>
              <ul class="list-disc pl-4">
                <For each={dropzone.fileRejections} fallback={<li>No files rejected :)</li>}>
                  {rejection => (
                    <li>
                      {rejection.file.name}:{' '}
                      <span class="text-sm">
                        {rejection.errors.map(e => `${e.code} - ${e.message}`).join(', ')}
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </div>
        </Show>

        <input {...dropzone.getInputProps({ id: 'input-0' })} />
      </div>
    </div>
  )
}

const App: Component = () => {
  return (
    <div class="max-w-screen-md mx-auto space-y-8 mt-8 px-8 pb-24">
      <h1 class="font-bold text-4xl">Solid Dropzone</h1>

      <Dropzone title="Nothing special" />
      <Dropzone title=".png only" accept=".png" />
      <Dropzone
        title="3 files max"
        maxFiles={3}
        onDrop={(...args) => console.log(args)}
        onError={err => console.error(err)}
      />
      <Dropzone
        title="1 file only (multiple=false)"
        multiple={false}
        onDrop={(...args) => console.log(args)}
        onError={err => console.error(err)}
      />
      <Dropzone
        title="1 file only (maxFiles=1)"
        maxFiles={1}
        onDrop={(...args) => console.log(args)}
        onError={err => console.error(err)}
      />
    </div>
  )
}

export default App
