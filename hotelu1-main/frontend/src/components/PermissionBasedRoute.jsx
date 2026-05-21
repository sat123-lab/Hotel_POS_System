import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import NoAccessMessage from './NoAccessMessage';

import { getAPI_URL } from '../utils/api';

const PermissionBasedRoute = ({ children, requiredPermissions = [], requiredRoles = [] }) => {
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = user.role;

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  const fetchUserPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/my-permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserPermissions(data.permissions || []);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Admin has all permissions
  if (userRole === 'admin') {
    return children;
  }

  // Check if user has any of the required roles
  if (requiredRoles.length > 0 && requiredRoles.includes(userRole)) {
    return children;
  }

  // Check if user has any of the required permissions
  if (requiredPermissions.length > 0) {
    const hasPermission = requiredPermissions.some(perm => userPermissions.includes(perm));
    if (hasPermission) {
      return children;
    }
  }

  // If neither role nor permission matches, deny access
  return <NoAccessMessage />;
};

export default PermissionBasedRoute;
