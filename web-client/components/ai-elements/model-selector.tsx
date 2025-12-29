import * as React from "react"
import { cn } from "@/lib/utils"

export const ModelSelector = ({ children, open, onOpenChange }: any) => <div>{children}</div>
export const ModelSelectorTrigger = ({ children, asChild }: any) => <div>{children}</div>
export const ModelSelectorContent = ({ children }: any) => <div className="border p-2 rounded mt-2 bg-white shadow-lg">{children}</div>
export const ModelSelectorInput = (props: any) => <input {...props} className="border p-1 w-full mb-2" />
export const ModelSelectorList = ({ children }: any) => <div className="max-h-60 overflow-y-auto">{children}</div>
export const ModelSelectorEmpty = ({ children }: any) => <div className="p-2 text-gray-500">{children}</div>
export const ModelSelectorGroup = ({ children, heading }: any) => (
  <div className="py-1">
    <div className="font-bold px-2 text-xs text-gray-500 uppercase">{heading}</div>
    {children}
  </div>
)
export const ModelSelectorItem = ({ children, onSelect, value }: any) => (
  <div onClick={onSelect} className="cursor-pointer hover:bg-gray-100 p-2 flex items-center rounded text-sm">
    {children}
  </div>
)
export const ModelSelectorLogo = ({ provider }: any) => <span className="mr-2 text-xs bg-gray-200 px-1 rounded">[{provider}]</span>
export const ModelSelectorName = ({ children }: any) => <span className="font-medium">{children}</span>
export const ModelSelectorLogoGroup = ({ children }: any) => <div className="flex ml-2 gap-1">{children}</div>
