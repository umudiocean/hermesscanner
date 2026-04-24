export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-surface-1 text-white antialiased">
        {children}
      </body>
    </html>
  )
}
