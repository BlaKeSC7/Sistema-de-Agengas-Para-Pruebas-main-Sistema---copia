import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
// import { services as mockServices } from '../utils/mockData'; // No longer use mockServices directly for display
import { useAppointments } from '../context/AppointmentContext';
import { Phone, MessageSquare, Calendar as CalendarIcon, Clock as ClockIcon, User } from 'lucide-react';
import { es } from 'date-fns/locale';

interface BookingFormProps {
  selectedDate: Date;
  selectedTime: string;
  selectedBarberId?: string;
  onSuccess: () => void;
}

const BookingForm: React.FC<BookingFormProps> = ({
  selectedDate,
  selectedTime,
  selectedBarberId,
  onSuccess
}) => {
  const { createAppointment, barbers, adminSettings, services } = useAppointments(); // Get services from context
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    service: '', // Initialize service as empty or handle loading state
    barber_id: selectedBarberId || adminSettings.default_barber_id || ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Set default service when services are loaded from context
    if (services && services.length > 0 && !formData.service) {
      setFormData(prev => ({
        ...prev,
        service: services[0].id
      }));
    }
  }, [services, formData.service]);

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const truncated = numbers.slice(0, 10);
    const matches = truncated.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!matches) return '';
    const formatted = matches.slice(1).filter(Boolean).join('-');
    const remaining = 12 - formatted.length;
    return formatted + '_'.repeat(Math.max(0, remaining));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData(prev => ({
      ...prev,
      clientPhone: formatted
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'clientPhone') return;
    setFormData({
      ...formData,
      [name]: value
    });
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.clientName.trim()) {
      newErrors.clientName = 'El nombre es obligatorio';
    }
    if (!formData.clientPhone.trim() || formData.clientPhone.includes('_')) {
      newErrors.clientPhone = 'El teléfono es obligatorio';
    } else if (!/^\d{3}-\d{3}-\d{4}$/.test(formData.clientPhone)) {
      newErrors.clientPhone = 'Formato: 555-123-4567';
    }
    console.log('[ValidateForm] adminSettings.multiple_barbers_enabled:', adminSettings.multiple_barbers_enabled);
    console.log('[ValidateForm] formData.barber_id:', formData.barber_id);
    console.log('[ValidateForm] !formData.barber_id:', !formData.barber_id);

    let isBarberIdMissing = false;
    if (adminSettings.multiple_barbers_enabled) {
      // Considera faltante si es null, undefined, o un string vacío.
      // Un número (como 1) no se consideraría faltante por esta lógica específica de "missing".
      // El backend luego validará si '1' es un ID de asistente válido.
      if (formData.barber_id == null || formData.barber_id === '') { // Usar == null para cubrir undefined y null, y === '' para string vacío
        isBarberIdMissing = true;
      } else if (typeof formData.barber_id === 'string' && formData.barber_id.trim() === '') {
        // Cubre el caso de un string que solo contiene espacios
        isBarberIdMissing = true;
      }
      // Si formData.barber_id es un número (ej. 1), o un string no vacío (ej. "uuid-string"), isBarberIdMissing será false.
    }

    if (isBarberIdMissing) {
      newErrors.barber_id = 'Debe seleccionar un asistente';
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    console.log('[ValidateForm] newErrors:', newErrors, 'isValid:', isValid);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formIsValid = validateForm();
    console.log('[HandleSubmit] formIsValid:', formIsValid);
    if (!formIsValid) return;

    try {
      let processedPhone = formData.clientPhone.replace(/\D/g, ''); // 1. Limpiar para obtener solo dígitos

      if (processedPhone.length === 10) {
        // 2. Si tiene 10 dígitos (ej. 8091234567), se asume que es de la región +1 y se antepone "+1".
        processedPhone = `+1${processedPhone}`;
      } else if (processedPhone.length === 11 && processedPhone.startsWith('1')) {
        // 3. Si tiene 11 dígitos y empieza con "1" (ej. 18091234567),
        //    se reemplaza el "1" inicial con "+" (quedando "+1809...").
        processedPhone = `+${processedPhone}`;
      }
      // Números con otros formatos o que ya contengan un '+' (y sobrevivieron parcialmente al replace)
      // se guardarán como queden. Ej: si alguien pone "+52..." y el replace quita el '+',
      // esta lógica no lo re-añadirá ni antepondrá +1. Se guardará "52...".
      // Si se quiere ser más estricto o manejar más casos, esta lógica se puede expandir.

      // Usar el asistente seleccionado o el por defecto
      const finalBarberId = selectedBarberId || formData.barber_id || adminSettings.default_barber_id;
      console.log('[HandleSubmit] finalBarberId for createAppointment:', finalBarberId,
                  'selectedBarberId:', selectedBarberId,
                  'formData.barber_id:', formData.barber_id,
                  'adminSettings.default_barber_id:', adminSettings.default_barber_id);
      
      await createAppointment({
        date: selectedDate,
        time: selectedTime,
        clientName: formData.clientName.trim(),
        clientPhone: processedPhone, // Usar el número procesado
        service: formData.service,
        barber_id: finalBarberId, // Asegurar que se use el asistente correcto
        confirmed: true
      });
      toast.success(
        <div>
          <p className="font-bold">¡Cita confirmada!</p>
          <p>Se enviará notificación al asistente por WhatsApp</p>
        </div>,
        { duration: 5000 }
      );
      onSuccess();
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      if (error.message === 'El horario seleccionado ya no está disponible') {
        toast.error('Este horario ya no está disponible. Por favor selecciona otro.');
      } else if (error.code === '23505') {
        toast.error('Ya existe una cita en este horario. Por favor selecciona otro.');
      } else {
        toast.error('Error al crear la cita. Por favor intenta nuevamente.');
      }
    }
  };

  const getBarberName = (barberId: string) => {
    const barber = barbers.find(b => b.id === barberId);
    return barber?.name || 'asistente';
  };

  return (
    <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-semibold mb-4">Detalles de la cita</h3>
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2 text-gray-600">
          <CalendarIcon className="w-5 h-5" />
          {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <ClockIcon className="w-5 h-5" />
          {selectedTime}
        </div>
        {selectedBarberId && (
          <div className="flex items-center gap-2 text-gray-600">
            <User className="w-5 h-5" />
            {getBarberName(selectedBarberId)}
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Selecciona el servicio
            </label>
            <select
              name="service"
              value={formData.service}
              onChange={handleChange}
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            >
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name} - ${service.price}
                </option>
              ))}
            </select>
          </div>

          {adminSettings.multiple_barbers_enabled && !selectedBarberId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selecciona el asistente
              </label>
              <select
                name="barber_id"
                value={formData.barber_id}
                onChange={handleChange}
                className={`block w-full p-2 border ${
                  errors.barber_id ? 'border-red-500' : 'border-gray-300'
                } rounded-md shadow-sm focus:ring-red-500 focus:border-red-500`}
              >
                <option value="">Seleccionar asistente</option>
                {barbers.map(barber => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
              {errors.barber_id && (
                <p className="mt-1 text-sm text-red-600">{errors.barber_id}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              name="clientName"
              value={formData.clientName}
              onChange={handleChange}
              className={`block w-full p-2 border ${
                errors.clientName ? 'border-red-500' : 'border-gray-300'
              } rounded-md shadow-sm focus:ring-red-500 focus:border-red-500`}
              placeholder="Juan Pérez"
            />
            {errors.clientName && (
              <p className="mt-1 text-sm text-red-600">{errors.clientName}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-1" />
                Teléfono
              </div>
            </label>
            <input
              type="text"
              name="clientPhone"
              value={formData.clientPhone}
              onChange={handlePhoneChange}
              className={`block w-full p-2 border ${
                errors.clientPhone ? 'border-red-500' : 'border-gray-300'
              } rounded-md shadow-sm focus:ring-red-500 focus:border-red-500`}
              placeholder="000-000-0000"
            />
            {errors.clientPhone && (
              <p className="mt-1 text-sm text-red-600">{errors.clientPhone}</p>
            )}
          </div>
        </div>
        
        <div className="mt-6 flex items-center">
          <MessageSquare className="h-5 w-5 text-green-600 mr-2" />
          <p className="text-sm text-gray-600">
            Se notificará automáticamente al asistente por WhatsApp después de reservar.
          </p>
        </div>
        
        <div className="mt-6">
          <button
            type="submit"
            className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors"
          >
            Confirmar cita
          </button>
        </div>
      </form>
    </div>
  );
};

export default BookingForm;