type Props = {
    item: { index: number, title: string, duration?: number };
    selectedItems: number[];
    setSelectedItems: React.Dispatch<React.SetStateAction<number[]>>
    formatDuration: (duration: number) => string;
}
export default function PlaylistItem({ item, selectedItems, setSelectedItems, formatDuration }: Props) {
    return (
        <label
            key={item.index}
            className={`flex items-center gap-3 p-2 rounded-md cursor-pointer text-sm transition-colors ${selectedItems.includes(item.index) ? "bg-zinc-800/80" : "hover:bg-zinc-800/40"}`}
        >
            <input
                type="checkbox"
                checked={selectedItems.includes(item.index)}
                onChange={(e) => {
                    if (e.target.checked) setSelectedItems(prev => [...prev, item.index]);
                    else setSelectedItems(prev => prev.filter(i => i !== item.index));
                }}
                className="rounded border-zinc-600 bg-zinc-900"
            />
            <span className="w-5 text-muted-foreground text-xs text-right shrink-0">{item.index}.</span>
            <span className="flex-1 truncate" title={item.title}>{item.title}</span>
            {item.duration && (
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatDuration(item.duration * 1000)}
                </span>
            )}
        </label>
    )
}