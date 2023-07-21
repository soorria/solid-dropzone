<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=solid-dropzone&background=tiles&project=%20" alt="solid-dropzone">
</p>

# solid-dropzone

[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg?style=for-the-badge&logo=pnpm)](https://pnpm.io/)

Drag and drop file input library for SolidJS.

> **Note**: This is a SolidJS port of [`react-dropzone`](https://github.com/react-dropzone/react-dropzone)

## Quick start

Install it:

```bash
npm i @soorria/solid-dropzone
# or
yarn add @soorria/solid-dropzone
# or
pnpm add @soorria/solid-dropzone
```

Use it:

```tsx
import { createDropzone } from '@soorria/solid-dropzone'
```

## Example

> Adapted from the first example here: https://github.com/react-dropzone/react-dropzone/#usage

```tsx
import { createDropzone } from '@soorria/solid-dropzone'

function MyDropzone() {
  const onDrop = (acceptedFiles: File[]) => {
    // Do something with the files
  }
  const dropzone = createDropzone({ onDrop })

  return (
    <div {...dropzone.getRootProps()}>
      <input {...dropzone.getInputProps()} />
      {
        dropzone.isDragActive ?
          <p>Drop the files here ...</p> :
          <p>Drag 'n' drop some files here, or click to select files</p>
      }
    </div>
  )
}
```
