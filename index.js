import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Schema, DOMParser } from 'prosemirror-model'
import { schema } from 'prosemirror-schema-basic'
import { addListNodes } from 'prosemirror-schema-list'
import { exampleSetup } from 'prosemirror-example-setup'
import { undo, redo } from 'prosemirror-history'

// Mix the nodes from prosemirror-schema-list into the basic schema to
// create a schema with list support.
const mySchema = new Schema({
  nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
  marks: schema.spec.marks
})

/**
 * Create a hidden contenteditable element
 * We perform fake actions on this element to manipulate the browser undo stack
 */
const undoMock = document.createElement('div')
undoMock.setAttribute('contenteditable', 'true')
undoMock.setAttribute('style', 'position:fixed; bottom:-5em;')
document.body.insertBefore(undoMock, null)

const setSelection = range => {
  const sel = window.getSelection()
  const previousRange = sel.rangeCount > 0 ? sel.getRangeAt(0) : null
  sel.removeAllRanges()
  sel.addRange(range)
  return previousRange
}

/**
 * By performing a fake action on `undoMock` we force the browser to put something on its undo-stack.
 * This also forces the browser to delete its redo stack.
 */
const simulateAddToUndoStack = () => {
  const range = document.createRange()
  range.selectNodeContents(undoMock)
  const restoreRange = setSelection(range)
  document.execCommand('insertText', false, 'x')
  setSelection(restoreRange)
  return restoreRange
}

let simulatedUndoActive = false

/**
 * By performing a fake undo on `undoMock`, we force the browser to put something on its redo-stack
 */
const simulateAddToRedoStack = () => {
  // Perform a fake action on undoMock. The browser will think that it can undo this action.
  const restoreRange = simulateAddToUndoStack()
  // wait for the next tick, and tell the browser to undo the fake action on undoMock
  simulatedUndoActive = true
  try {
    document.execCommand('undo')
  } finally {
    simulatedUndoActive = false
  }
  // restore previous selection
  setSelection(restoreRange)
}

const view = new EditorView(document.querySelector('#editor'), {
  state: EditorState.create({
    doc: DOMParser.fromSchema(mySchema).parse(document.querySelector('#content')),
    plugins: exampleSetup({ schema: mySchema })
  }),
  handleDOMEvents: {
    beforeinput: (view, event) => beforeinputHandler(event)
  }
})

const beforeinputHandler = event => {
  // we only handle user interactions
  if (simulatedUndoActive) {
    return
  }
  switch (event.inputType) {
    case 'historyUndo':
      event.preventDefault()
      undo(view.state, view.dispatch)
      if (undo(view.state)) {
        // we can perform another undo
        simulateAddToUndoStack()
      }
      simulateAddToRedoStack()
      return true
    case 'historyRedo':
      event.preventDefault()
      redo(view.state, view.dispatch)
      if (!redo(view.state)) {
        // by triggering another action, we force the browser to empty the undo stack
        simulateAddToUndoStack()
      } else {
        simulateAddToRedoStack()
      }
      return true
  }
  return false
}

// In safari the historyUndo/Redo event is triggered on the undoMock
// In Chrome these events are triggered on the editor
undoMock.addEventListener('beforeinput', beforeinputHandler)
