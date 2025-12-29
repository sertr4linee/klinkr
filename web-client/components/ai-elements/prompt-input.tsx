import * as React from "react"

export const PromptInputProvider = ({ children }: any) => <div>{children}</div>
export const PromptInput = ({ children, onSubmit }: any) => (
  <div className="border p-4 rounded-lg shadow-sm bg-white">
    {children}
  </div>
)
export const PromptInputAttachments = ({ children }: any) => <div>{children}</div>
export const PromptInputAttachment = ({ data }: any) => <div>Attachment</div>
export const PromptInputBody = ({ children }: any) => <div className="my-2">{children}</div>
export const PromptInputTextarea = React.forwardRef((props: any, ref: any) => (
  <textarea ref={ref} className="w-full border p-2 rounded min-h-[100px]" placeholder="Type a message..." {...props} />
))
PromptInputTextarea.displayName = "PromptInputTextarea"

export const PromptInputFooter = ({ children }: any) => <div className="flex justify-between items-center mt-2">{children}</div>
export const PromptInputTools = ({ children }: any) => <div className="flex gap-2 items-center">{children}</div>
export const PromptInputActionMenu = ({ children }: any) => <div className="relative">{children}</div>
export const PromptInputActionMenuTrigger = () => <button className="p-2 hover:bg-gray-100 rounded">+</button>
export const PromptInputActionMenuContent = ({ children }: any) => <div className="absolute bottom-full mb-2 bg-white border rounded shadow p-2">{children}</div>
export const PromptInputActionAddAttachments = () => <button className="text-sm">Add Attachment</button>
export const PromptInputSpeechButton = ({ textareaRef }: any) => <button className="p-2 hover:bg-gray-100 rounded">🎤</button>
export const PromptInputButton = ({ children, onClick }: any) => <button onClick={onClick} className="p-2 border rounded hover:bg-gray-50 flex items-center gap-2 text-sm">{children}</button>
export const PromptInputSubmit = ({ status }: any) => <button className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800">{status === 'streaming' ? 'Stop' : 'Send'}</button>

export const usePromptInputController = () => ({
  textInput: {
    clear: () => console.log("Clear input"),
    setInput: (val: string) => console.log("Set input", val),
  },
  attachments: {
    clear: () => console.log("Clear attachments"),
  }
})

export interface PromptInputMessage {
  text: string
  files?: any[]
}
