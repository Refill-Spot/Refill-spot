"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import StoreDetail from "@/components/store-detail"
import { storeData } from "@/lib/store-data"

export default function StorePage() {
  const params = useParams()
  const router = useRouter()
  const [store, setStore] = useState(null)

  useEffect(() => {
    if (params.id) {
      const foundStore = storeData.find((s) => s.id === Number.parseInt(params.id as string))
      setStore(foundStore)
    }
  }, [params.id])

  const handleBack = () => {
    router.back()
  }

  if (!store) {
    return <div className="p-8 text-center">가게 정보를 불러오는 중...</div>
  }

  return <StoreDetail store={store} onBack={handleBack} />
}
