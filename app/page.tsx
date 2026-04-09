"use client"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

// Говорим TypeScript, что объект Telegram существует в window
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Telegram: any
  }
}

export default function Home() {
  const [chatId, setChatId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(true) // Теперь грузимся, пока получаем ID
  const [userName, setUserName] = useState<string>("")

  useEffect(() => {
    // Оборачиваем логику в setTimeout, чтобы сделать вызов асинхронным
    // Это избавляет от ошибки "cascading renders" линтера React
    const timer = setTimeout(() => {
      const tg = window.Telegram?.WebApp

      if (tg) {
        tg.ready()
        tg.expand()

        const user = tg.initDataUnsafe?.user
        if (user) {
          setChatId(user.id.toString())
          setUserName(user.first_name || "Друг")
        } else {
          setStatus("❌ Открой приложение внутри Telegram")
        }
      } else {
        setStatus("❌ Скрипт Telegram не загрузился")
      }

      setIsLoading(false)
    }, 0)

    // Очистка таймера при размонтировании компонента (хорошая практика)
    return () => clearTimeout(timer)
  }, [])

  const registerUser = async () => {
    if (!chatId) return
    setIsLoading(true)

    // Пытаемся добавить пользователя
    const { error } = await supabase.from("users").insert([{ chat_id: chatId }])

    if (error) {
      // Код 23505 означает нарушение уникальности (пользователь уже есть)
      if (error.code === "23505") {
        setStatus("ℹ️ Ты уже зарегистрирован в системе!")
      } else {
        setStatus("❌ Ошибка при регистрации")
      }
    } else {
      setStatus("✅ Успешно зарегистрирован!")
    }
    setIsLoading(false)
  }

  const markAsTaken = async () => {
    if (!chatId) return
    setIsLoading(true)

    const today = new Date().toISOString().split("T")[0]
    const { error } = await supabase
      .from("users")
      .update({ last_taken_date: today })
      .eq("chat_id", chatId)

    if (error) {
      setStatus("❌ Ошибка при отметке")
    } else {
      setStatus("💊 Молодец! Таблетка выпита, сегодня больше не потревожу.")

      // Можно автоматически закрыть приложение после успешной отметки
      setTimeout(() => {
        window.Telegram?.WebApp?.close()
      }, 2000)
    }
    setIsLoading(false)
  }

  // Пока грузимся (получаем ID)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Загрузка...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold text-gray-800 text-center">
          Привет, {userName}! 💊
        </h1>

        <p className="text-center text-sm text-gray-600">
          Твой профиль подключен автоматически.
        </p>

        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={registerUser}
            disabled={isLoading || !chatId}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold px-4 py-3 rounded-lg transition-colors"
          >
            Начать получать напоминания
          </button>

          <button
            onClick={markAsTaken}
            disabled={isLoading || !chatId}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white font-semibold px-4 py-3 rounded-lg transition-colors"
          >
            Я выпил таблетку!
          </button>
        </div>

        {status && (
          <div className="mt-2 p-3 bg-gray-100 rounded-lg text-center text-sm font-medium text-gray-700">
            {status}
          </div>
        )}
      </div>
    </main>
  )
}
