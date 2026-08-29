'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney, toMajor } from '@/lib/money';
import type { SalesPoint } from '@/lib/services/admin-stats';

/**
 * منحنى المبيعات اليومية.
 *
 * ملاحظة RTL: recharts يرسم من اليسار إلى اليمين افتراضيًا. نعكس المحور
 * بـ `reversed` ليقرأ التاريخ من اليمين لليسار كما يتوقع القارئ العربي،
 * ونضع محور القيم على اليمين لنفس السبب.
 *
 * القيم تصل بالوحدة الصغرى وتُحوَّل للعرض فقط — لا حسابات مالية هنا.
 */
export function SalesChart({
  data,
  currency,
}: {
  data: SalesPoint[];
  currency: { symbol: string; decimals: number };
}) {
  const hasAny = data.some((point) => point.revenue > 0);

  if (!hasAny) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--text-muted)]">
        لا توجد مبيعات في هذه الفترة بعد
      </div>
    );
  }

  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--accent)"
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor="var(--accent)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--surface-border)"
            vertical={false}
          />

          <XAxis
            dataKey="label"
            reversed
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--surface-border)' }}
            interval="preserveStartEnd"
          />

          <YAxis
            orientation="right"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => String(Math.round(toMajor(value)))}
          />

          <Tooltip
            cursor={{ stroke: 'var(--accent)', strokeWidth: 1 }}
            contentStyle={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--surface-border)',
              borderRadius: '0.75rem',
              fontSize: '0.8rem',
              direction: 'rtl',
            }}
            labelStyle={{ color: 'var(--text-muted)', marginBottom: 4 }}
            formatter={(value, name) => {
              const amount = typeof value === 'number' ? value : 0;
              const isRevenue = name === 'revenue';

              return [
                isRevenue
                  ? formatMoney(amount, {
                      currency: currency.symbol,
                      decimals: currency.decimals,
                    })
                  : String(amount),
                isRevenue ? 'المبيعات' : 'الطلبات',
              ];
            }}
          />

          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#revenueFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
