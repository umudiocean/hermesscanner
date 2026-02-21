export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-[#0c0c14] text-white antialiased">
        {children}
      </body>
    </html>
  )
}
