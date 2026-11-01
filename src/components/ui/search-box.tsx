import { Search } from 'lucide-react'

export function SearchBox({ 
  value,
  onChange,
  placeholder
}: {
  value: string; 
  onChange: (v: string) => void; 
  placeholder: string 
}) {
  return (
    <label className="input input-sm w-full max-w-xs">
      <Search className="size-4 opacity-50" />
      <input 
        type="search" 
        value={value} 
        placeholder={placeholder} 
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}