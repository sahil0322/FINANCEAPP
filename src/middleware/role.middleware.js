import { ApiError } from '../utils/ApiError.js';

// Factory function — returns a middleware configured for specific roles
// Usage: router.get('/admin/users', verifyJWT, authorizeRoles('admin'), controller)
// WHY factory pattern? You might need authorizeRoles('admin', 'superadmin') later.

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // req.user is guaranteed to exist here because verifyJWT runs first
    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        403,
        `Role '${req.user.role}' is not authorized to access this resource.`
      );
    }
    next();
  };
};