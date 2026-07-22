{{- define "umer.fullname" -}}
{{- .Release.Name -}}
{{- end -}}

{{- define "umer.labels" -}}
app.kubernetes.io/name: umer-ai-os
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "umer.selectorLabels" -}}
app.kubernetes.io/name: umer-ai-os
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "umer.image" -}}
{{- if .root.Values.imageRegistry -}}
{{ printf "%s/%s:%s" .root.Values.imageRegistry .image .root.Values.imageTag }}
{{- else -}}
{{ printf "%s:%s" .image .root.Values.imageTag }}
{{- end -}}
{{- end -}}
