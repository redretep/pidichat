"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Paperclip, Send, Mic, Users, Wifi, WifiOff } from "lucide-react"

interface Message {
  type: "text" | "image" | "audio"
  from: string
  time: string
  content: string
  id: string
}

export default function PidiChat() {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")
  const [nickname, setNickname] = useState("")
  const [room, setRoom] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessage, setCurrentMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [connectedPeers, setConnectedPeers] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const yArrayRef = useRef<any>(null)
  const docRef = useRef<any>(null)
  const providerRef = useRef<any>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const connect = async () => {
    if (!nickname.trim() || !room.trim()) {
      alert("Enter both nickname and room name.")
      return
    }

    setConnectionStatus("connecting")

    try {
      // Load Yjs and WebRTC provider
      const [Y, { WebrtcProvider }] = await Promise.all([import("yjs"), import("y-webrtc")])

      const doc = new Y.Doc()

      // Configure WebRTC with proper STUN servers for cross-device communication
      const provider = new WebrtcProvider(room, doc, {
        signaling: [
          "wss://signaling.yjs.dev",
          "wss://y-webrtc-signaling-eu.herokuapp.com",
          "wss://y-webrtc-signaling-us.herokuapp.com",
        ],
        password: null,
        awareness: true,
        maxConns: 20 + Math.floor(Math.random() * 15),
        filterBcConns: true,
        peerOpts: {
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:stun2.l.google.com:19302" },
              { urls: "stun:stun3.l.google.com:19302" },
              { urls: "stun:stun4.l.google.com:19302" },
              { urls: "stun:stun.services.mozilla.com" },
            ],
            iceCandidatePoolSize: 10,
          },
        },
      })

      const yArray = doc.getArray("messages")

      docRef.current = doc
      yArrayRef.current = yArray
      providerRef.current = provider

      // Connection status monitoring
      provider.on("status", (event: any) => {
        console.log("WebRTC Status:", event.status)
        if (event.status === "connected") {
          setConnectionStatus("connected")
        } else if (event.status === "connecting") {
          setConnectionStatus("connecting")
        } else {
          setConnectionStatus("disconnected")
        }
      })

      // Peer connection monitoring
      provider.on("peers", (event: any) => {
        console.log("Connected peers:", event.added, event.removed)
        setConnectedPeers(provider.room?.bcConns?.size || 0)
      })

      // Listen for message changes
      const updateMessages = () => {
        try {
          const newMessages = yArray.toArray() as Message[]
          console.log("Messages updated:", newMessages.length)
          setMessages([...newMessages])
        } catch (error) {
          console.error("Error updating messages:", error)
        }
      }

      yArray.observe(updateMessages)
      updateMessages() // Initial load

      // Add connection test message
      setTimeout(() => {
        const testMessage: Message = {
          type: "text",
          from: "System",
          time: new Date().toLocaleTimeString(),
          content: `${nickname} joined the room`,
          id: `system-${Date.now()}`,
        }
        yArray.push([testMessage])
      }, 1000)

      setIsConnected(true)
      setConnectionStatus("connected")
    } catch (error) {
      console.error("Connection error:", error)
      alert("Failed to connect. Please try again.")
      setConnectionStatus("disconnected")
    }
  }

  const sendMessage = useCallback(() => {
    const msg = currentMessage.trim()
    if (msg && yArrayRef.current) {
      try {
        const time = new Date().toLocaleTimeString()
        const newMessage: Message = {
          type: "text",
          from: nickname,
          time,
          content: msg,
          id: `${nickname}-${Date.now()}-${Math.random()}`,
        }
        console.log("Sending message:", newMessage)
        yArrayRef.current.push([newMessage])
        setCurrentMessage("")
      } catch (error) {
        console.error("Error sending message:", error)
      }
    }
  }, [currentMessage, nickname])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  const sendImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !yArrayRef.current) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const base64 = event.target?.result as string
          const time = new Date().toLocaleTimeString()
          const newMessage: Message = {
            type: "image",
            from: nickname,
            time,
            content: base64,
            id: `${nickname}-img-${Date.now()}`,
          }
          yArrayRef.current.push([newMessage])
        } catch (error) {
          console.error("Error sending image:", error)
        }
      }
      reader.readAsDataURL(file)
    },
    [nickname],
  )

  const startRecording = useCallback(() => {
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
          try {
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
                id: `${nickname}-audio-${Date.now()}`,
              }
              if (yArrayRef.current) {
                yArrayRef.current.push([newMessage])
              }
            }
            reader.readAsDataURL(blob)
          } catch (error) {
            console.error("Error processing audio:", error)
          }
          stream.getTracks().forEach((track) => track.stop())
        }

        recorder.start()
        setIsRecording(true)
      })
      .catch(() => alert("Microphone access denied"))
  }, [nickname])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop()
      setIsRecording(false)
    }
  }, [])

  const addEmojiReaction = useCallback(
    (emoji: string, messageIndex: number) => {
      if (yArrayRef.current) {
        try {
          const time = new Date().toLocaleTimeString()
          const reactionMessage: Message = {
            type: "text",
            from: nickname,
            time,
            content: `${emoji} reacted to message #${messageIndex + 1}`,
            id: `${nickname}-reaction-${Date.now()}`,
          }
          yArrayRef.current.push([reactionMessage])
        } catch (error) {
          console.error("Error adding reaction:", error)
        }
      }
    },
    [nickname],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        providerRef.current.destroy()
      }
      if (docRef.current) {
        docRef.current.destroy()
      }
    }
  }, [])

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold mb-8 text-center">🟢 PidiChat</h1>
        <p className="text-zinc-400 text-center mb-8 max-w-md">
          Minimal P2P Web Chat - No login, no server, no tracking. Just open and chat!
        </p>

        <div className="w-full max-w-md space-y-4">
          <Input
            placeholder="Enter your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            onKeyDown={(e) => e.key === "Enter" && room && connect()}
          />
          <Input
            placeholder="Enter room name"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            onKeyDown={(e) => e.key === "Enter" && nickname && connect()}
          />
          <Button
            onClick={connect}
            disabled={connectionStatus === "connecting" || !nickname.trim() || !room.trim()}
            className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50"
          >
            {connectionStatus === "connecting" ? "Connecting..." : "Join Chat"}
          </Button>
        </div>

        <div className="mt-8 text-xs text-zinc-500 text-center max-w-md">
          <p>✨ Features: Real-time messaging, Image sharing, Voice messages, Emoji reactions</p>
          <p className="mt-2">🔒 100% client-side - Your messages never touch our servers</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🟢 PidiChat</h1>
          <p className="text-sm text-zinc-400">Room: {room}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{connectedPeers + 1}</span>
          </div>
          <div className="flex items-center gap-1">
            {connectionStatus === "connected" ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className={connectionStatus === "connected" ? "text-green-500" : "text-red-500"}>
              {connectionStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, index) => (
          <div
            key={msg.id || index}
            className={`max-w-[75%] p-3 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 ${
              msg.from === nickname ? "ml-auto bg-zinc-700" : "bg-zinc-800"
            }`}
          >
            <div className="font-semibold text-sm mb-1 flex items-center justify-between">
              <span>{msg.from}</span>
              <span className="text-xs text-zinc-400">{msg.time}</span>
            </div>

            {msg.type === "text" && <div className="whitespace-pre-wrap">{msg.content}</div>}

            {msg.type === "image" && (
              <img
                src={msg.content || "/placeholder.svg?height=200&width=300"}
                alt="Shared image"
                className="max-w-full rounded-lg mt-2"
              />
            )}

            {msg.type === "audio" && (
              <audio controls className="mt-2 w-full">
                <source src={msg.content} type="audio/webm" />
                Your browser does not support audio playback.
              </audio>
            )}

            {msg.from !== "System" && (
              <div className="flex gap-2 mt-2">
                {["❤️", "🔥", "😂", "👍", "👀"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => addEmojiReaction(emoji, index)}
                    className="text-lg hover:scale-110 transition-transform opacity-70 hover:opacity-100"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
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
            className="text-white hover:bg-zinc-800 shrink-0"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <input ref={fileInputRef} type="file" accept="image/*" onChange={sendImage} className="hidden" />

          <Textarea
            placeholder="Type a message..."
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-zinc-800 border-zinc-700 text-white resize-none min-h-[40px] max-h-32 placeholder:text-zinc-500"
            rows={1}
          />

          <Button
            onClick={sendMessage}
            size="icon"
            className="bg-zinc-700 hover:bg-zinc-600 shrink-0"
            disabled={!currentMessage.trim()}
          >
            <Send className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`text-white hover:bg-zinc-800 shrink-0 ${isRecording ? "bg-red-600 hover:bg-red-700" : ""}`}
          >
            <Mic className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
