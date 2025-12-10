"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreVertical, Eye, Edit, Trash2, Users } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { TopicProperties } from "@/types/azure"

interface TopicTableProps {
  topics: TopicProperties[]
  onTopicClick: (topic: TopicProperties) => void
  onEdit: (topic: TopicProperties) => void
  onDelete: (topicName: string) => void
  onViewSubscriptions: (topic: TopicProperties) => void
}

export function TopicTable({
  topics,
  onTopicClick,
  onEdit,
  onDelete,
  onViewSubscriptions,
}: TopicTableProps) {
  const formatSize = (bytes: number | undefined) => {
    if (!bytes) return "-"
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${bytes} B`
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Name</TableHead>
            <TableHead className="w-[100px] text-right">Subscriptions</TableHead>
            <TableHead className="w-[100px] text-right">Size</TableHead>
            <TableHead className="w-[150px]">Features</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {topics.map((topic, index) => (
            <TableRow
              key={`${topic.name}-${index}`}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onTopicClick(topic)}
            >
              <TableCell className="font-medium">{topic.name}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span>{topic.subscriptionCount || 0}</span>
                </div>
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {formatSize(topic.sizeInBytes)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {topic.enablePartitioning && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      P
                    </Badge>
                  )}
                  {topic.requiresDuplicateDetection && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      D
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onTopicClick(topic)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onViewSubscriptions(topic)}>
                      <Users className="h-4 w-4 mr-2" />
                      View Subscriptions
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(topic)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(topic.name)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

