import * as React from 'react';
import { AppContext } from '../context/AppContext';
import { MODE_DETAILS, TrashIcon, SendIcon } from '../constants';
import { ChatMode, TodoTask } from '../types';

const CheckmarkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const TodoItem: React.FC<{
    task: TodoTask;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
}> = React.memo(({ task, onToggle, onDelete }) => {
    const [showAnimation, setShowAnimation] = React.useState(false);
    const prevCompletedRef = React.useRef(task.completed);

    React.useEffect(() => {
        if (task.completed && !prevCompletedRef.current) {
            setShowAnimation(true);
            const timer = setTimeout(() => setShowAnimation(false), 1000); // Animation duration
            return () => clearTimeout(timer);
        }
        prevCompletedRef.current = task.completed;
    }, [task.completed]);

    return (
        <div className="relative flex items-center bg-slate-800/50 p-3 rounded-lg my-2 animate-fadeIn transition-all duration-300 hover:bg-slate-700/60">
            {showAnimation && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="animate-checkmark-pop">
                        <CheckmarkIcon />
                    </div>
                </div>
            )}
            <input
                type="checkbox"
                checked={task.completed}
                onChange={() => onToggle(task.id)}
                className="form-checkbox h-5 w-5 bg-slate-700 border-slate-600 rounded text-sky-500 focus:ring-sky-500/50 z-10"
            />
            <span className={`flex-1 ml-4 transition-colors duration-300 ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                {task.text}
            </span>
            <button
                onClick={() => onDelete(task.id)}
                className="p-2 text-slate-400 hover:text-red-400 rounded-full transition-colors z-10"
                aria-label="Delete task"
            >
                <TrashIcon />
            </button>
        </div>
    );
});

const TodoWindow: React.FC = () => {
    const context = React.useContext(AppContext);
    const [newTask, setNewTask] = React.useState('');

    if (!context) return null;
    const { todos, setTodos } = context;
    const { placeholder } = MODE_DETAILS[ChatMode.Todo];

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTask.trim()) {
            const task: TodoTask = {
                id: Date.now().toString(),
                text: newTask.trim(),
                completed: false,
            };
            setTodos(prevTodos => [task, ...prevTodos]);
            setNewTask('');
        }
    };

    const handleToggleTask = React.useCallback((id: string) => {
        setTodos(prevTodos =>
            prevTodos.map(task =>
                task.id === id ? { ...task, completed: !task.completed } : task
            )
        );
    }, [setTodos]);

    const handleDeleteTask = React.useCallback((id: string) => {
        setTodos(prevTodos => prevTodos.filter(task => task.id !== id));
    }, [setTodos]);

    return (
        <div className="flex flex-col h-full w-full bg-black/10 backdrop-blur-2xl border border-white/10 rounded-2xl p-4">
            <header className="text-center mb-4 border-b border-slate-600/50 pb-3">
                <h2 className="text-xl font-bold">{MODE_DETAILS[ChatMode.Todo].name}</h2>
                <p className="text-xs text-slate-400">Your personal task manager</p>
            </header>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                {todos.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-slate-400">No tasks yet. Add one below!</p>
                    </div>
                ) : (
                    todos.map(task => (
                        <TodoItem
                            key={task.id}
                            task={task}
                            onToggle={handleToggleTask}
                            onDelete={handleDeleteTask}
                        />
                    ))
                )}
            </div>
            
            <form onSubmit={handleAddTask} className="relative mt-auto">
                <div className="bg-slate-800/50 border border-slate-600/50 rounded-2xl p-2 flex items-center backdrop-blur-sm">
                    <input
                        type="text"
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder={placeholder}
                        className="flex-1 bg-transparent p-2 pr-12 focus:outline-none placeholder-slate-400"
                    />
                    <button
                        type="submit"
                        className="absolute right-4 bottom-3 p-2 rounded-full transition-colors duration-200 bg-sky-500 text-white disabled:bg-slate-600 disabled:cursor-not-allowed"
                        aria-label="Add task"
                        disabled={!newTask.trim()}
                    >
                        <SendIcon />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TodoWindow;