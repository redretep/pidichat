"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Paperclip, Send, Mic } from "lucide-react"

// Types for messages
interface Message {
  type: "text" | "image" | "audio"
  from: string
  time: string
  content: string
}

export default function PidiChat() {
  const [isConnected, setIsConnected] = useState(false)
  const [nickname, setNickname] = useState("")
  const [room, setRoom] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessage, setCurrentMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const yArrayRef = useRef<any>(null)
  const docRef = useRef<any>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const connect = () => {
    if (!nickname.trim() || !room.trim()) {
      alert("Enter both nickname and room name.")
      return
    }

    // Initialize Yjs and WebRTC
    if (typeof window !== "undefined") {
      // Load Yjs dynamically
      import("yjs").then((Y) => {
        import("y-webrtc").then((WebrtcProvider) => {
          const doc = new Y.Doc()
          const provider = new WebrtcProvider.WebrtcProvider(room, doc)
          const yArray = doc.getArray("messages")

          docRef.current = doc
          yArrayRef.current = yArray

          // Listen for changes
          yArray.observe(() => {
            const newMessages = yArray.toArray() as Message[]
            setMessages([...newMessages])
          })

          // Initial render
          const initialMessages = yArray.toArray() as Message[]
          setMessages([...initialMessages])

          setIsConnected(true)
        })
      })
    }
  }

  const sendMessage = () => {
    const msg = currentMessage.trim()
    if (msg && yArrayRef.current) {
      const time = new Date().toLocaleTimeString()
      const newMessage: Message = {
        type: "text",
        from: nickname,
        time,
        content: msg,
      }
      yArrayRef.current.push([newMessage])
      setCurrentMessage("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const sendImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !yArrayRef.current) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      const time = new Date().toLocaleTimeString()
      const newMessage: Message = {
        type: "image",
        from: nickname,
        time,
        content: base64,
      }
      yArrayRef.current.push([newMessage])
    }
    reader.readAsDataURL(file)
  }

  const startRecording = () => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const recorder = new MediaRecorder(stream)
        recorderRef.current = recorder
        audioChunksRef.current = []

        recorder.ondataavailable = (e) => {
          audioChunksRef.current.push(e.data)
        }

        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64 = reader.result as string
            const time = new Date().toLocaleTimeString()
            const newMessage: Message = {
              type: "audio",
              from: nickname,
              time,
              content: base64,
            }
            if (yArrayRef.current) {
              yArrayRef.current.push([newMessage])
            }
          }
          reader.readAsDataURL(blob)
          stream.getTracks().forEach((track) => track.stop())
        }

        recorder.start()
        setIsRecording(true)
      })
      .catch(() => alert("Microphone access denied"))
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const addEmojiReaction = (emoji: string, messageIndex: number) => {
    if (yArrayRef.current) {
      const time = new Date().toLocaleTimeString()
      const reactionMessage: Message = {
        type: "text",
        from: nickname,
        time,
        content: `${emoji} on msg #${messageIndex + 1}`,
      }
      yArrayRef.current.push([reactionMessage])
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold mb-8 text-center">PidiChat</h1>
        <div className="w-full max-w-md space-y-4">
          <Input
            placeholder="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
          <Input
            placeholder="Room name"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
          <Button onClick={connect} className="w-full bg-zinc-700 hover:bg-zinc-600">
            Join Chat
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-2xl font-bold text-center">PidiChat</h1>
        <p className="text-sm text-zinc-400 text-center">Room: {room}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`max-w-[75%] p-3 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 ${
              msg.from === nickname ? "ml-auto bg-zinc-700" : "bg-zinc-800"
            }`}
          >
            <div className="font-semibold text-sm mb-1">{msg.from}</div>

            {msg.type === "text" && <div className="whitespace-pre-wrap">{msg.content}</div>}

            {msg.type === "image" && (
              <img src={msg.content || "/placeholder.svg"} alt="Shared image" className="max-w-full rounded-lg mt-2" />
            )}

            {msg.type === "audio" && (
              <audio controls className="mt-2">
                <source src={msg.content} type="audio/webm" />
              </audio>
            )}

            <div className="flex gap-2 mt-2">
              {["❤️", "🔥", "😂", "👍", "👀"].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => addEmojiReaction(emoji, index)}
                  className="text-lg hover:scale-110 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="text-white hover:bg-zinc-800"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <input ref={fileInputRef} type="file" accept="image/*" onChange={sendImage} className="hidden" />

          <Textarea
            placeholder="Type a message..."
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-zinc-800 border-zinc-700 text-white resize-none min-h-[40px] max-h-32"
            rows={1}
          />

          <Button onClick={sendMessage} size="icon" className="bg-zinc-700 hover:bg-zinc-600">
            <Send className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`text-white hover:bg-zinc-800 ${isRecording ? "bg-red-600" : ""}`}
          >
            <Mic className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
