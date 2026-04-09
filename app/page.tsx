"use client"
import { useCallback, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

// Говорим TypeScript, что объект Telegram существует в window
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Telegram: any
  }
}

// Удобная схема из изображения
const DAILY_TASKS = [
  { id: "1", label: "утром натощак — FeMe Complex 2 капсулы", icon: "🌅" },
  {
    id: "2",
    label: "через 30–60 минут завтрак + Ibuvit D3 2 капсулы",
    icon: "🍳",
  },
  {
    id: "3",
    label: "днем или вечером после еды — 100 мл бурякового закваса",
    icon: "🥤",
  },
]

export default function Home() {
  const [chatId, setChatId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Состояние выполненных задач {"1": true, "2": false, "3": true}
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>(
    {},
  )
  const [isRegistered, setIsRegistered] = useState<boolean>(false)

  // Получаем сегодняшнюю дату в формате YYYY-MM-DD
  const getTodayDate = () => new Date().toISOString().split("T")[0]

  const fetchUserData = useCallback(async (userId: string) => {
    // Получаем данные пользователя из Supabase
    const { data, error } = await supabase
      .from("users")
      .select("chat_id, completed_tasks, last_update_date")
      .eq("chat_id", userId)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = User not found
      console.error("Ошибка при получении данных:", error)
      return
    }

    const today = getTodayDate()

    if (!data) {
      // Пользователь не найден
      setIsRegistered(false)
      setCompletedTasks({})
    } else {
      setIsRegistered(true)

      // КРИТИЧЕСКИЙ МОМЕНТ: Логика сброса
      if (data.last_update_date !== today) {
        // Если дата не совпадает с сегодняшней (наступил новый день или первый вход),
        // сбрасываем галочки локально и в базе
        setCompletedTasks({})
        await supabase
          .from("users")
          .update({
            completed_tasks: {},
            last_update_date: today,
          })
          .eq("chat_id", userId)
      } else {
        // Если день тот же, загружаем сохраненные галочки
        setCompletedTasks(data.completed_tasks || {})
      }
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    // Оборачиваем в асинхронную функцию, чтобы отложить обновление стейта
    // и избежать предупреждения о синхронном каскадном рендере
    const initTelegram = async () => {
      const tg = window.Telegram?.WebApp
      if (tg) {
        tg.ready()
        tg.expand()

        const user = tg.initDataUnsafe?.user
        if (user) {
          const userId = user.id.toString()
          setChatId(userId)
          setUserName(user.first_name || "Друг")
          await fetchUserData(userId) // Теперь мы дожидаемся получения данных
        } else {
          console.error("Приложение открыто не в Telegram")
          setIsLoading(false)
        }
      } else {
        console.error("Скрипт Telegram не загрузился")
        setIsLoading(false)
      }
    }

    initTelegram()
  }, [fetchUserData])

  const registerUser = async () => {
    if (!chatId) return
    setIsLoading(true)

    const today = getTodayDate()

    // Пытаемся добавить пользователя
    const { error } = await supabase.from("users").insert([
      {
        chat_id: chatId,
        completed_tasks: {},
        last_update_date: today,
      },
    ])

    if (error) {
      // Пользователь уже есть
      if (error.code === "23505") {
        fetchUserData(chatId) // Просто перезагрузим данные
      } else {
        alert("Ошибка при регистрации")
        setIsLoading(false)
      }
    } else {
      setIsRegistered(true)
      setCompletedTasks({})
      setIsLoading(false)
    }
  }

  // Логика переключения чекбокса
  const handleTaskToggle = async (taskId: string) => {
    if (!chatId) return

    // Сначала обновляем локальное состояние, чтобы интерфейс реагировал мгновенно
    setCompletedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId], // Инвертируем значение
    }))

    // Подготавливаем обновленный JSON для базы данных
    const updatedCompletedTasks = {
      ...completedTasks,
      [taskId]: !completedTasks[taskId],
    }

    // Отправляем JSONB-обновление в Supabase
    await supabase
      .from("users")
      .update({ completed_tasks: updatedCompletedTasks })
      .eq("chat_id", chatId)
  }

  const allCompleted = DAILY_TASKS.every(task => completedTasks[task.id])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white text-xl">
        Загрузка...
      </div>
    )
  }

  if (!chatId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-red-500 p-6 text-center">
        Открой приложение внутри Telegram
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center p-6 text-white font-sans">
      <div className="max-w-md w-full flex flex-col gap-6">
        {/* Заголовок */}
        <h1 className="text-2xl font-bold border-b border-gray-800 pb-4 text-gray-200">
          Удобная схема:
        </h1>

        {/* Интерактивный список задач */}
        <div className="flex flex-col gap-4">
          {DAILY_TASKS.map((task, index) => (
            <div
              key={task.id}
              className={`bg-gray-950 p-5 rounded-2xl flex items-center gap-4 transition-all duration-300 border ${completedTasks[task.id] ? "border-emerald-800" : "border-gray-800"}`}
            >
              <input
                type="checkbox"
                checked={!!completedTasks[task.id]} // Гарантируем boolean
                onChange={() => handleTaskToggle(task.id)}
                className="w-7 h-7 bg-black border-2 border-gray-700 rounded-lg accent-emerald-500 cursor-pointer focus:ring-emerald-500 focus:outline-none"
              />
              <div className="flex-1 flex gap-3">
                <span className="text-3xl">{task.icon}</span>
                <p
                  className={`text-lg leading-snug ${completedTasks[task.id] ? "text-gray-500 line-through" : "text-gray-100"}`}
                >
                  {task.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Кнопки действий */}
        {!isRegistered && (
          <button
            onClick={registerUser}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold px-4 py-3 rounded-xl transition-colors mt-4"
          >
            Включить напоминания (3 р/день)
          </button>
        )}

        {/* Мотивационное сообщение */}
        {allCompleted && (
          <div className="mt-2 p-4 bg-emerald-950/50 border border-emerald-800 rounded-2xl text-center text-base font-medium text-emerald-300">
            🎉 Молодец! Все задачи на сегодня выполнены. До завтра!
          </div>
        )}

        {/* Приветствие пользователя */}
        <div className="mt-auto text-center pt-10 text-gray-700 text-sm">
          Аккаунт: {userName}
        </div>
      </div>
    </main>
  )
}
