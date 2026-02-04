import { configureStore } from '@reduxjs/toolkit'
import { authApi } from './api/authApi'
import { gameApi } from './api/gameApi'
import authReducer from './slices/authSlice'
import gameReducer from './slices/gameSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    game: gameReducer,
    [authApi.reducerPath]: authApi.reducer,
    [gameApi.reducerPath]: gameApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(authApi.middleware, gameApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
