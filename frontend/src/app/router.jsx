import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "../components/layout/storefront/MainLayout";
import { AdminLayout } from "../components/layout/admin/AdminLayout";
import { RequireAdmin, RequireAuth } from "../features/auth";
import HomePage from "../pages/HomePage";
import { AccountLayout } from "../features/account";
import ProfilePage from "../pages/account/ProfilePage";
import AddressesPage from "../pages/account/AddressesPage";
import PaymentMethodsPage from "../pages/account/PaymentMethodsPage";
import OrdersPage from "../pages/account/OrdersPage";
import NotFoundPage from "../pages/NotFoundPage";

const AuthPage = lazy(() => import("../pages/AuthPage"));
const ProductsPage = lazy(() => import("../pages/ProductsPage"));
const CartPage = lazy(() => import("../pages/CartPage"));
const ProductDetailsPage = lazy(() => import("../pages/ProductDetailsPage"));
const AdminDashboardPage = lazy(
  () => import("../pages/admin/AdminDashboardPage"),
);
const AdminProductsPage = lazy(
  () => import("../pages/admin/AdminProductsPage"),
);
const AdminProductEditorPage = lazy(
  () => import("../pages/admin/AdminProductEditorPage"),
);

export function AppRoutes({ loadingFallback }) {
  return (
    <Routes>
      <Route
        path="/"
        element={<MainLayout loadingFallback={loadingFallback} />}
      >
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailsPage />} />
        <Route path="cart" element={<RequireAuth><CartPage /></RequireAuth>} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="signup" element={<AuthPage mode="register" />} />

        <Route
          path="account"
          element={
            <RequireAuth>
              <AccountLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="addresses" element={<AddressesPage />} />
          <Route path="payment-methods" element={<PaymentMethodsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout loadingFallback={loadingFallback} />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="products/new" element={<AdminProductEditorPage />} />
        <Route path="products/:id/edit" element={<AdminProductEditorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
