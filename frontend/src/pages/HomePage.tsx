import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-5xl font-bold mb-8 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
        Options Trading Game
      </h1>
      <p className="text-xl text-gray-400 mb-12 max-w-md text-center">
        Compete with friends to see who can make the most money trading options!
      </p>
      <div className="flex gap-4">
        <Link
          to="/login"
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
        >
          Login
        </Link>
        <Link
          to="/register"
          className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
        >
          Register
        </Link>
      </div>
    </div>
  )
}
