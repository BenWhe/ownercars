"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SupabaseTestPage() {
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    const supabase = createClient();

    async function testConnection() {
      const { error } = await supabase.auth.getSession();

      if (error) {
        setStatus(`Error: ${error.message}`);
      } else {
        setStatus("Supabase connected successfully");
      }
    }

    testConnection();
  }, []);

  return (
    <main style={{ padding: "40px" }}>
      <h1>OwnerCars Supabase Test</h1>
      <p>{status}</p>
    </main>
  );
}